// The language server, a child process a client of the protocol launches,
// which talks JSON-RPC over stdio and answers each request of the protocol
// by the functions of features.mjs.

import { readFileSync } from 'node:fs';
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
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parse, partOf, langRuntime, LANGUAGE_SOURCES, SIGNS_A_WORD_FOLLOWS } from '@kaluchi/qlang-core';
import {
  parseDocument,
  buildCatalogIndex,
  completionsAtOffset,
  hoverAtOffset,
  definitionAtOffset,
  referencesAtOffset,
  documentSymbols,
  foldingRangesOf,
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
// Every source of the language takes part in goto-definition: its
// declarations merge into one `address → { uri, source, range }` table,
// and the scope of the root answers the address a bare name reaches, so
// `count` and `::number/add/SubjectNotNumberError` resolve through one lookup.

let catalogCtx = null;

async function loadCatalogContext() {
  // The file of each source of the language where the core's package exports
  // it, `@kaluchi/qlang-core/lib/<uri>.qlang`, resolved from the server's own
  // dependency, its URL the location goto-definition returns [QSHST#source].
  const sources = LANGUAGE_SOURCES.map(uri => ({ fileUri: import.meta.resolve(`@kaluchi/qlang-core/lib/${uri}.qlang`), uri }));

  const mergedIndex = new Map();
  for (const { fileUri, uri } of sources) {
    try {
      const source = readFileSync(new URL(fileUri), 'utf8');
      const root = partOf(parse(source, { uri }));
      const entries = buildCatalogIndex(root);
      for (const [name, range] of entries) {
        mergedIndex.set(name, { ...range, fileUri, source });
      }
    } catch (e) {
      connection.console.warn(`catalog source ${fileUri} not loaded: ${e.message}`);
    }
  }
  catalogCtx = mergedIndex.size > 0 ? { index: mergedIndex, scope: await langRuntime() } : null;
}

// ── Initialization ────────────────────────────────────────────

connection.onInitialize(async () => {
  await loadCatalogContext();
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: { triggerCharacters: [...SIGNS_A_WORD_FOLLOWS] },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      foldingRangeProvider: true,
      signatureHelpProvider: { triggerCharacters: [' '] },
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
  const { root, diagnostics: rawDiags } = parseDocument(source, uri);

  documentStates.set(uri, { root, source });

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

// The roles of a declaration as the kinds of a completion and a symbol [QSHST#tools].
const COMPLETION_KIND_OF_ROLE = {
  verb:  CompletionItemKind.Function,
  value: CompletionItemKind.Variable,
  label: CompletionItemKind.Struct
};

const SYMBOL_KIND_OF_ROLE = {
  verb:  SymbolKind.Function,
  value: SymbolKind.Variable,
  label: SymbolKind.Struct
};

connection.onCompletion(async (params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const offset = doc.offsetAt(params.position);
  const items = await completionsAtOffset(state?.root ?? null, offset, state?.source ?? null);

  return items.map(item => ({
    label: item.label,
    kind: COMPLETION_KIND_OF_ROLE[item.role],
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
  if (!state?.root || !doc) return null;

  const offset = doc.offsetAt(params.position);
  const hover = await hoverAtOffset(state.root, state.source, offset);
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

connection.onDefinition(async (params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!state?.root || !doc) return null;

  const offset = doc.offsetAt(params.position);
  const def = await definitionAtOffset(state.root, offset, catalogCtx);
  if (!def) return null;

  // A declaration of the catalog stands in the file of its source.
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
  if (!state?.root || !doc) return [];

  const offset = doc.offsetAt(params.position);
  const refs = referencesAtOffset(state.root, offset);

  return refs.map(ref => ({
    uri: params.textDocument.uri,
    range: {
      start: doc.positionAt(ref.startOffset),
      end: doc.positionAt(ref.endOffset)
    }
  }));
});

// ── Document Symbols ──────────────────────────────────────────

connection.onDocumentSymbol(async (params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!state?.root || !doc) return [];

  const symbols = documentSymbols(state.root, await langRuntime());

  return symbols.map(sym => ({
    name: sym.name,
    kind: SYMBOL_KIND_OF_ROLE[sym.role],
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

// ── Folding ───────────────────────────────────────────────────

connection.onFoldingRanges((params) => {
  const state = documentStates.get(params.textDocument.uri);
  return state?.root ? foldingRangesOf(state.root) : [];
});

// ── Signature Help ────────────────────────────────────────────

connection.onSignatureHelp(async (params) => {
  const state = documentStates.get(params.textDocument.uri);
  const doc = documents.get(params.textDocument.uri);
  if (!state?.root || !doc) return null;

  const offset = doc.offsetAt(params.position);
  const sig = await signatureHelpAtOffset(state.root, state.source, offset);
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
// The client requests semantic tokens for the whole document; the
// returned `{ data }` is a Uint32Array carrying the LSP-encoded
// token stream (5 ints per token). The editor merges it on top of
// the tmLanguage grammar tokens so a reader's names get the
// `variable` colour distinct from the `function` colour of the
// verbs of the language.

connection.languages.semanticTokens.on(async (params) => {
  const state = documentStates.get(params.textDocument.uri);
  if (!state?.source) return { data: [] };
  return await semanticTokensFor(state.source);
});

// ── Start ─────────────────────────────────────────────────────

documents.listen(connection);
connection.listen();
