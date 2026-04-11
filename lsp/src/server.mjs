// qlang language server — LSP wiring over features.mjs.
//
// Runs as a child process spawned by the VS Code extension client.
// Communicates via stdio JSON-RPC. All qlang-specific logic lives
// in features.mjs; this file only maps between LSP protocol types
// and the feature functions.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  CompletionItemKind,
  DiagnosticSeverity,
  MarkupKind,
  SymbolKind,
  SignatureInformation,
  ParameterInformation
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parse } from '@kaluchi/qlang';
import {
  parseDocument,
  buildCatalogIndex,
  completionsAtOffset,
  hoverAtOffset,
  definitionAtOffset,
  referencesAtOffset,
  documentSymbols,
  signatureHelpAtOffset
} from './features.mjs';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// Per-document parsed state.
const documentStates = new Map();

// ── Catalog context ───────────────────────────────────────────
//
// Parsed once at startup. Provides go-to-definition fallback
// for builtin operands — jumps to the `:name {...}` MapEntry
// inside lib/qlang/core.qlang's outer catalog MapLit.

let catalogCtx = null;

function loadCatalogContext() {
  try {
    // Resolve core.qlang relative to @kaluchi/qlang package.
    // The lsp package depends on @kaluchi/qlang via file:..
    // so the package root is at ../../ relative to this file.
    const lspSrcDir = dirname(fileURLToPath(import.meta.url));
    const catalogPath = join(lspSrcDir, '..', '..', 'lib', 'qlang', 'core.qlang');
    const catalogSource = readFileSync(catalogPath, 'utf8');
    const catalogAst = parse(catalogSource, { uri: 'qlang/core' });
    const catalogUri = 'file:///' + catalogPath.replace(/\\/g, '/');
    catalogCtx = {
      uri: catalogUri,
      index: buildCatalogIndex(catalogAst)
    };
  } catch (e) {
    connection.console.warn(`lib/qlang/core.qlang not loaded: ${e.message}`);
    catalogCtx = null;
  }
}

// ── Initialization ────────────────────────────────────────────

connection.onInitialize(() => {
  loadCatalogContext();
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: { triggerCharacters: ['|', '/', ':', '(', ' '] },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      signatureHelpProvider: { triggerCharacters: ['(', ','] }
    }
  };
});

// ── Diagnostics on document change ────────────────────────────

function validateDocument(textDocument) {
  const source = textDocument.getText();
  const uri = textDocument.uri;
  const { ast, diagnostics: rawDiags } = parseDocument(source, uri);

  documentStates.set(uri, { ast, source });

  const diagnostics = rawDiags.map(d => ({
    range: {
      start: { line: d.startLine, character: d.startChar },
      end: { line: d.endLine, character: d.endChar }
    },
    severity: d.severity === 'error'
      ? DiagnosticSeverity.Error
      : DiagnosticSeverity.Warning,
    source: 'qlang',
    message: d.message
  }));

  connection.sendDiagnostics({ uri, diagnostics });
}

documents.onDidChangeContent(change => validateDocument(change.document));
documents.onDidClose(e => {
  documentStates.delete(e.document.uri);
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

// ── Completion ────────────────────────────────────────────────

const COMPLETION_KIND_MAP = {
  function: CompletionItemKind.Function,
  variable: CompletionItemKind.Variable
};

connection.onCompletion((params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const offset = doc.offsetAt(params.position);
  const items = completionsAtOffset(state?.ast ?? null, offset);

  return items.map(item => ({
    label: item.label,
    kind: COMPLETION_KIND_MAP[item.kind] ?? CompletionItemKind.Text,
    detail: item.detail,
    documentation: item.documentation
      ? { kind: MarkupKind.Markdown, value: item.documentation }
      : undefined
  }));
});

// ── Hover ─────────────────────────────────────────────────────

connection.onHover((params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!state?.ast || !doc) return null;

  const offset = doc.offsetAt(params.position);
  const hover = hoverAtOffset(state.ast, state.source, offset);
  if (!hover) return null;

  return {
    contents: { kind: MarkupKind.Markdown, value: hover.content },
    range: {
      start: doc.positionAt(hover.startOffset),
      end: doc.positionAt(hover.endOffset)
    }
  };
});

// ── Go to Definition ──────────────────────────────────────────

connection.onDefinition((params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!state?.ast || !doc) return null;

  const offset = doc.offsetAt(params.position);
  const def = definitionAtOffset(state.ast, offset, catalogCtx);
  if (!def) return null;

  // def.uri is null for in-document declarations, catalog URI
  // for builtin fallback.
  const targetUri = def.uri ?? params.textDocument.uri;

  // For catalog locations, open the catalog file and convert
  // offsets to positions there. For in-document declarations,
  // use the current document.
  if (def.uri) {
    return {
      uri: def.uri,
      range: offsetRangeToLineCol(catalogSourceText(), def.startOffset, def.endOffset)
    };
  }

  return {
    uri: targetUri,
    range: {
      start: doc.positionAt(def.startOffset),
      end: doc.positionAt(def.endOffset)
    }
  };
});

let _catalogSourceText = null;

function catalogSourceText() {
  if (_catalogSourceText) return _catalogSourceText;
  try {
    const lspSrcDir = dirname(fileURLToPath(import.meta.url));
    const catalogPath = join(lspSrcDir, '..', '..', 'lib', 'qlang', 'core.qlang');
    _catalogSourceText = readFileSync(catalogPath, 'utf8');
  } catch {
    _catalogSourceText = '';
  }
  return _catalogSourceText;
}

function offsetRangeToLineCol(source, startOffset, endOffset) {
  return {
    start: offsetToPosition(source, startOffset),
    end: offsetToPosition(source, endOffset)
  };
}

function offsetToPosition(source, offset) {
  let line = 0;
  let lastNewline = -1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      lastNewline = i;
    }
  }
  return { line, character: offset - lastNewline - 1 };
}

// ── Find References ───────────────────────────────────────────

connection.onReferences((params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!state?.ast || !doc) return [];

  const offset = doc.offsetAt(params.position);
  const refs = referencesAtOffset(state.ast, offset);

  return refs.map(ref => ({
    uri: params.textDocument.uri,
    range: {
      start: doc.positionAt(ref.startOffset),
      end: doc.positionAt(ref.endOffset)
    }
  }));
});

// ── Document Symbols (Outline) ────────────────────────────────

const SYMBOL_KIND_MAP = {
  conduit: SymbolKind.Function,
  snapshot: SymbolKind.Variable
};

connection.onDocumentSymbol((params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!state?.ast || !doc) return [];

  const symbols = documentSymbols(state.ast);

  return symbols.map(sym => ({
    name: sym.name,
    kind: SYMBOL_KIND_MAP[sym.kind] ?? SymbolKind.Variable,
    range: {
      start: doc.positionAt(sym.startOffset),
      end: doc.positionAt(sym.endOffset)
    },
    selectionRange: {
      start: doc.positionAt(sym.startOffset),
      end: doc.positionAt(sym.endOffset)
    }
  }));
});

// ── Signature Help ────────────────────────────────────────────

connection.onSignatureHelp((params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!state?.ast || !doc) return null;

  const offset = doc.offsetAt(params.position);
  const sig = signatureHelpAtOffset(state.ast, state.source, offset);
  if (!sig) return null;

  const sigInfo = SignatureInformation.create(
    sig.label,
    sig.documentation
  );
  sigInfo.parameters = sig.parameters.map(p =>
    ParameterInformation.create(p.label)
  );

  return {
    signatures: [sigInfo],
    activeSignature: 0,
    activeParameter: sig.activeParameter
  };
});

// ── Start ─────────────────────────────────────────────────────

documents.listen(connection);
connection.listen();
