// LSP feature implementations — pure functions over qlang's public
// API. No vscode-languageserver imports here; the server.mjs wiring
// layer translates between LSP protocol types and these returns.
//
// Each function takes a parsed state and returns plain objects that
// server.mjs maps to LSP responses. This split keeps the logic
// testable without LSP transport.

import {
  parse, ParseError,
  langRuntime,
  findAstNodeAtOffset,
  bindingNamesVisibleAt,
  walkAst,
  QlangError, QlangTypeError
} from '@kaluchi/qlang';

// ── Document state ────────────────────────────────────────────
//
// Each open document gets a parsed AST and a diagnostic list.
// Re-parsed on every content change.

export function parseDocument(source, uri) {
  const diagnostics = [];
  let ast = null;
  try {
    ast = parse(source, { uri });
  } catch (e) {
    if (e instanceof ParseError && e.location) {
      diagnostics.push({
        startLine: e.location.start.line - 1,
        startChar: e.location.start.column - 1,
        endLine: e.location.end ? e.location.end.line - 1 : e.location.start.line - 1,
        endChar: e.location.end ? e.location.end.column - 1 : e.location.start.column,
        message: e.message,
        severity: 'error'
      });
    } else {
      diagnostics.push({
        startLine: 0, startChar: 0,
        endLine: 0, endChar: 0,
        message: e.message ?? String(e),
        severity: 'error'
      });
    }
  }
  return { ast, diagnostics };
}

// ── Completion ────────────────────────────────────────────────
//
// Two sources: builtin operand names from langRuntime, and
// user-defined bindings visible at the cursor offset via
// bindingNamesVisibleAt.

let _builtinCompletions = null;

function builtinCompletions() {
  if (_builtinCompletions) return _builtinCompletions;
  const runtime = langRuntime();
  _builtinCompletions = [];
  for (const [k, v] of runtime) {
    if (k && typeof k === 'object' && k.type === 'keyword') {
      const meta = v?.meta ?? {};
      _builtinCompletions.push({
        label: k.name,
        kind: 'function',
        detail: meta.category ?? null,
        documentation: Array.isArray(meta.docs) && meta.docs.length > 0
          ? meta.docs[0]
          : null
      });
    }
  }
  return _builtinCompletions;
}

export function completionsAtOffset(ast, offset) {
  const items = [...builtinCompletions()];

  if (ast) {
    const userNames = bindingNamesVisibleAt(ast, offset);
    for (const name of userNames) {
      if (!items.some(i => i.label === name)) {
        items.push({
          label: name,
          kind: 'variable',
          detail: 'user binding',
          documentation: null
        });
      }
    }
  }

  return items;
}

// ── Hover ─────────────────────────────────────────────────────
//
// Finds the AST node at the cursor offset. If it's an
// OperandCall, looks up docs from the runtime. If it's a
// Projection, describes the projection path.

export function hoverAtOffset(ast, source, offset) {
  if (!ast) return null;

  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return null;

  if (node.type === 'OperandCall') {
    return hoverForOperand(node);
  }
  if (node.type === 'Projection') {
    return hoverForProjection(node);
  }
  if (node.type === 'Keyword') {
    return {
      content: `keyword \`:${node.name}\``,
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    };
  }
  return null;
}

function hoverForOperand(node) {
  const runtime = langRuntime();
  const kw = findKeyword(runtime, node.name);
  if (!kw) return null;

  const fn = runtime.get(kw);
  const meta = fn?.meta ?? {};
  const lines = [];

  lines.push(`**${node.name}** — ${meta.category ?? 'operand'}`);

  if (meta.subject) {
    const subjectLabel = formatMetaValue(meta.subject);
    lines.push(`Subject: ${subjectLabel}`);
  }
  if (Array.isArray(meta.docs) && meta.docs.length > 0) {
    lines.push('', meta.docs.join('\n'));
  }

  return {
    content: lines.join('\n'),
    startOffset: node.location.start.offset,
    endOffset: node.location.end.offset
  };
}

function hoverForProjection(node) {
  const pathStr = '/' + node.keys.join('/');
  return {
    content: `projection \`${pathStr}\` — extracts value from Map`,
    startOffset: node.location.start.offset,
    endOffset: node.location.end.offset
  };
}

function findKeyword(runtime, name) {
  for (const k of runtime.keys()) {
    if (k && typeof k === 'object' && k.type === 'keyword' && k.name === name) {
      return k;
    }
  }
  return null;
}

function formatMetaValue(value) {
  if (value === null || value === undefined) return 'any';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.type === 'keyword') return value.name;
  if (Array.isArray(value)) {
    return value.map(formatMetaValue).join(' | ');
  }
  return String(value);
}
