// qlang language server — LSP wiring over features.mjs.
//
// Runs as a child process spawned by the VS Code extension client.
// Communicates via stdio JSON-RPC. All qlang-specific logic lives
// in features.mjs; this file only maps between LSP protocol types
// and the feature functions.

import { readFileSync, readdirSync } from 'node:fs';
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
import { parse } from '@kaluchi/qlang-core';
import {
  parseDocument,
  buildCatalogIndex,
  completionsAtOffset,
  hoverAtOffset,
  definitionAtOffset,
  referencesAtOffset,
  documentSymbols,
  signatureHelpAtOffset,
  semanticTokensFor,
  SEMANTIC_TOKEN_TYPES
} from './features.mjs';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// Per-document parsed state.
const documentStates = new Map();

// ── Catalog context ───────────────────────────────────────────
//
// Every operand-family file under `core/lib/qlang/operand/*.qlang`
// plus `runtime-invariants.qlang` and `tag.qlang` participate in
// goto-definition. Each declares operand descriptors (value-namespace)
// and per-site error tag-bindings (tag-namespace) inline. The LSP
// startup walk parses all of them, merging into one `name →
// { uri, source, range }` lookup table so a single
// `definitionAtOffset` lookup serves both value-namespace
// identifiers (`count`) and tag-namespace identifiers
// (`::AddLeftNotNumberError`).

let catalogCtx = null;

function loadCatalogContext() {
  // Monorepo layout: `lsp/` and `core/` are sibling workspaces,
  // so catalog files sit under `../core/lib/qlang/...` relative
  // to `lsp/src/`.
  const lspSrcDir = dirname(fileURLToPath(import.meta.url));
  const libDir = join(lspSrcDir, '..', '..', 'core', 'lib', 'qlang');

  // Discovery walks lib/qlang recursively for every `.qlang` file.
  // The namespace URI mirrors the relative path with `/` separators
  // and the `.qlang` suffix stripped; the resolved file URI lets
  // goto-definition return absolute locations the editor can open.
  const sources = [];
  function walk(dir, prefix) {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const childPath = join(dir, name.name);
      const childUri = prefix ? prefix + '/' + name.name : name.name;
      if (name.isDirectory()) {
        walk(childPath, childUri);
      } else if (name.name.endsWith('.qlang')) {
        sources.push({ path: childPath, uri: 'qlang/' + childUri.replace(/\.qlang$/, '') });
      }
    }
  }
  walk(libDir, '');

  const mergedIndex = new Map();
  for (const { path, uri } of sources) {
    try {
      const source = readFileSync(path, 'utf8');
      const ast = parse(source, { uri });
      const fileUri = 'file:///' + path.replace(/\\/g, '/');
      const entries = buildCatalogIndex(ast);
      for (const [name, range] of entries) {
        mergedIndex.set(name, { ...range, fileUri, source });
      }
    } catch (e) {
      connection.console.warn(`catalog source ${path} not loaded: ${e.message}`);
    }
  }
  catalogCtx = mergedIndex.size > 0 ? { index: mergedIndex } : null;
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
      signatureHelpProvider: { triggerCharacters: ['(', ','] },
      semanticTokensProvider: {
        legend: { tokenTypes: SEMANTIC_TOKEN_TYPES, tokenModifiers: [] },
        full: true
      }
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
  variable: CompletionItemKind.Variable,
  tag:      CompletionItemKind.Struct
};

connection.onCompletion(async (params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const offset = doc.offsetAt(params.position);
  const items = await completionsAtOffset(state?.ast ?? null, offset, state?.source ?? null);

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

connection.onHover(async (params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!state?.ast || !doc) return null;

  const offset = doc.offsetAt(params.position);
  const hover = await hoverAtOffset(state.ast, state.source, offset);
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

  // Catalog hits carry their own source-text + file URI; in-document
  // declarations carry only offsets and rely on the current document
  // for offset→position conversion.
  if (def.fileUri) {
    return {
      uri: def.fileUri,
      range: offsetRangeToLineCol(def.source, def.startOffset, def.endOffset)
    };
  }

  return {
    uri: params.textDocument.uri,
    range: {
      start: doc.positionAt(def.startOffset),
      end: doc.positionAt(def.endOffset)
    }
  };
});

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
  conduit:  SymbolKind.Function,
  snapshot: SymbolKind.Variable,
  tag:      SymbolKind.Struct
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

connection.onSignatureHelp(async (params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!state?.ast || !doc) return null;

  const offset = doc.offsetAt(params.position);
  const sig = await signatureHelpAtOffset(state.ast, state.source, offset);
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

// ── Semantic Tokens ───────────────────────────────────────────
//
// VS Code requests semantic tokens for the whole document; the
// returned `{ data }` is a Uint32Array carrying the LSP-encoded
// token stream (5 ints per token). The editor merges it on top of
// the tmLanguage grammar tokens so `@`-prefixed effectful operands
// pick up the `decorator` colour and user-bound atoms get the
// `variable` colour distinct from the `function` colour of
// `langRuntime`-resolved built-ins.

connection.languages.semanticTokens.on(async (params) => {
  const state = documentStates.get(params.textDocument.uri);
  if (!state?.source) return { data: [] };
  return await semanticTokensFor(state.source);
});

// ── Start ─────────────────────────────────────────────────────

documents.listen(connection);
connection.listen();
