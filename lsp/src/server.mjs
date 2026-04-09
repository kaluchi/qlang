// qlang language server — LSP wiring over features.mjs.
//
// Runs as a child process spawned by the VS Code extension client.
// Communicates via stdio JSON-RPC. All qlang-specific logic lives
// in features.mjs; this file only maps between LSP protocol types
// and the feature functions.

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  CompletionItemKind,
  DiagnosticSeverity,
  MarkupKind
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  parseDocument,
  completionsAtOffset,
  hoverAtOffset
} from './features.mjs';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// Per-document parsed state.
const documentStates = new Map();

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Full,
    completionProvider: { triggerCharacters: ['|', '/', ':', '(', ' '] },
    hoverProvider: true
  }
}));

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

// ── Start ─────────────────────────────────────────────────────

documents.listen(connection);
connection.listen();
