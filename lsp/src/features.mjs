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
  findIdentifierOccurrences,
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

// ── Go to Definition ──────────────────────────────────────────
//
// From a use site (bare OperandCall or identifier reference),
// jumps to the let/as declaration that introduced the binding.
// Builtins have no source declaration — returns null for them.

export function definitionAtOffset(ast, offset) {
  if (!ast) return null;

  const node = findAstNodeAtOffset(ast, offset);
  if (!node || node.type !== 'OperandCall') return null;

  const name = node.name;
  const occurrences = findIdentifierOccurrences(ast, name);

  // Declaration site: an OperandCall named 'let' or 'as' whose
  // first Keyword arg matches the identifier name.
  for (const occ of occurrences) {
    if ((occ.name === 'let' || occ.name === 'as')
        && Array.isArray(occ.args) && occ.args.length > 0
        && occ.args[0].type === 'Keyword' && occ.args[0].name === name
        && occ.location) {
      return {
        startOffset: occ.location.start.offset,
        endOffset: occ.location.end.offset
      };
    }
  }

  return null;
}

// ── Find References ───────────────────────────────────────────
//
// Returns all occurrences of the identifier under the cursor:
// declaration sites (let/as), call sites (bare OperandCall),
// and projection segments that name the identifier.

export function referencesAtOffset(ast, offset) {
  if (!ast) return [];

  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return [];

  let name = null;
  if (node.type === 'OperandCall') {
    // Could be a use site (node.name === identifierName) or a
    // declaration site (node.name === 'let'/'as', first arg is
    // the keyword). For declarations, extract the bound name.
    if ((node.name === 'let' || node.name === 'as')
        && Array.isArray(node.args) && node.args.length > 0
        && node.args[0].type === 'Keyword') {
      name = node.args[0].name;
    } else {
      name = node.name;
    }
  } else if (node.type === 'Keyword' && node.parent
             && node.parent.type === 'OperandCall'
             && (node.parent.name === 'let' || node.parent.name === 'as')
             && Array.isArray(node.parent.args)
             && node.parent.args[0] === node) {
    // Cursor is on the keyword arg of let(:name, ...) or as(:name)
    name = node.name;
  }

  if (!name) return [];

  const occurrences = findIdentifierOccurrences(ast, name);
  return occurrences
    .filter(occ => occ.location)
    .map(occ => ({
      startOffset: occ.location.start.offset,
      endOffset: occ.location.end.offset
    }));
}

// ── Document Symbols ──────────────────────────────────────────
//
// Collects all let/as binding declarations for the Outline view
// and breadcrumb navigation. Each symbol carries the binding
// name, kind (conduit vs snapshot), and source range.

export function documentSymbols(ast) {
  if (!ast) return [];

  const symbols = [];
  walkAst(ast, (node) => {
    if (node.type !== 'OperandCall') return;
    if (node.name !== 'let' && node.name !== 'as') return;
    if (!Array.isArray(node.args) || node.args.length === 0) return;
    const firstArg = node.args[0];
    if (firstArg.type !== 'Keyword') return;
    if (!node.location) return;

    symbols.push({
      name: firstArg.name,
      kind: node.name === 'let' ? 'conduit' : 'snapshot',
      startOffset: node.location.start.offset,
      endOffset: node.location.end.offset
    });
  });
  return symbols;
}

// ── Signature Help ────────────────────────────────────────────
//
// When the cursor sits inside an operand call's parentheses
// (e.g. `filter(|` where | is cursor), returns the operand
// signature: subject type, modifier types, and docs.

export function signatureHelpAtOffset(ast, source, offset) {
  if (!ast) return null;

  // Walk up the AST from the narrowest node at offset to find
  // the enclosing OperandCall with args (i.e., has parentheses).
  const node = findAstNodeAtOffset(ast, offset);
  if (!node) return null;

  const operandCall = findEnclosingOperandCall(node);
  if (!operandCall) return null;

  const runtime = langRuntime();
  const kw = findKeyword(runtime, operandCall.name);
  if (!kw) return null;

  const fn = runtime.get(kw);
  const meta = fn?.meta ?? {};

  const modifiers = Array.isArray(meta.modifiers)
    ? meta.modifiers.map(formatMetaValue)
    : [];

  // Count which argument the cursor is in by counting commas
  // before the offset within the args region.
  const argsStartOffset = operandCall.location.start.offset
    + operandCall.name.length + 1; // skip "name("
  const textBeforeCursor = source.substring(argsStartOffset, offset);
  const activeParameter = (textBeforeCursor.match(/,/g) || []).length;

  const signatureLabel = modifiers.length > 0
    ? `${operandCall.name}(${modifiers.join(', ')})`
    : `${operandCall.name}()`;

  return {
    label: signatureLabel,
    documentation: Array.isArray(meta.docs) && meta.docs.length > 0
      ? meta.docs[0]
      : null,
    parameters: modifiers.map(mod => ({ label: mod })),
    activeParameter
  };
}

function findEnclosingOperandCall(node) {
  let current = node;
  while (current) {
    if (current.type === 'OperandCall' && current.args !== null) {
      return current;
    }
    current = current.parent;
  }
  return null;
}
