// Tests for LSP feature logic — pure functions, no LSP transport.

import { describe, it, expect } from 'vitest';
import {
  parseDocument, completionsAtOffset, hoverAtOffset,
  definitionAtOffset, referencesAtOffset, documentSymbols,
  signatureHelpAtOffset
} from '../src/features.mjs';

describe('parseDocument', () => {
  it('parses valid qlang source without diagnostics', () => {
    const { ast, diagnostics } = parseDocument('[1 2 3] | count', 'test.qlang');
    expect(ast).not.toBeNull();
    expect(ast.type).toBe('Pipeline');
    expect(diagnostics).toHaveLength(0);
  });

  it('returns a diagnostic for a parse error', () => {
    const { ast, diagnostics } = parseDocument('[1 2 3', 'test.qlang');
    expect(ast).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].message).toBeTruthy();
  });

  it('diagnostic has source location', () => {
    const { diagnostics } = parseDocument('| |', 'test.qlang');
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]).toHaveProperty('startLine');
    expect(diagnostics[0]).toHaveProperty('startChar');
  });
});

describe('completionsAtOffset', () => {
  it('includes builtin operand names', () => {
    const { ast } = parseDocument('', 'test.qlang');
    const items = completionsAtOffset(ast, 0);
    const labels = items.map(i => i.label);
    expect(labels).toContain('count');
    expect(labels).toContain('filter');
    expect(labels).toContain('add');
    expect(labels).toContain('let');
    expect(labels).toContain('as');
    expect(labels).toContain('reify');
  });

  it('returns more than 60 builtin completions', () => {
    const { ast } = parseDocument('', 'test.qlang');
    const items = completionsAtOffset(ast, 0);
    expect(items.length).toBeGreaterThan(60);
  });

  it('builtins have function kind', () => {
    const { ast } = parseDocument('', 'test.qlang');
    const items = completionsAtOffset(ast, 0);
    const countItem = items.find(i => i.label === 'count');
    expect(countItem.kind).toBe('function');
  });

  it('builtins have documentation from manifest', () => {
    const { ast } = parseDocument('', 'test.qlang');
    const items = completionsAtOffset(ast, 0);
    const countItem = items.find(i => i.label === 'count');
    expect(countItem.documentation).toBeTruthy();
    expect(countItem.documentation).toMatch(/number of elements/);
  });

  it('includes user-defined bindings visible at offset', () => {
    const src = 'let(:myVar, 42) | myVar';
    const { ast } = parseDocument(src, 'test.qlang');
    const offsetAtEnd = src.length;
    const items = completionsAtOffset(ast, offsetAtEnd);
    const labels = items.map(i => i.label);
    expect(labels).toContain('myVar');
  });

  it('user binding has variable kind', () => {
    const src = 'let(:myVar, 42) | myVar';
    const { ast } = parseDocument(src, 'test.qlang');
    const items = completionsAtOffset(ast, src.length);
    const myVarItem = items.find(i => i.label === 'myVar');
    expect(myVarItem.kind).toBe('variable');
  });

  it('works with null ast (parse failure)', () => {
    const items = completionsAtOffset(null, 0);
    expect(items.length).toBeGreaterThan(60);
  });
});

describe('hoverAtOffset', () => {
  it('returns hover for a builtin operand', () => {
    const src = '[1 2 3] | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const countOffset = src.indexOf('count');
    const hover = hoverAtOffset(ast, src, countOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/count/);
    expect(hover.content).toMatch(/vec-reducer/);
  });

  it('hover includes docs from manifest', () => {
    const src = '[1 2 3] | filter(gt(2))';
    const { ast } = parseDocument(src, 'test.qlang');
    const filterOffset = src.indexOf('filter');
    const hover = hoverAtOffset(ast, src, filterOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/predicate/i);
  });

  it('returns hover for a projection', () => {
    const src = '{:name "alice"} | /name';
    const { ast } = parseDocument(src, 'test.qlang');
    const projOffset = src.indexOf('/name');
    const hover = hoverAtOffset(ast, src, projOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/projection/);
    expect(hover.content).toMatch(/\/name/);
  });

  it('returns hover for a keyword literal', () => {
    const src = ':hello';
    const { ast } = parseDocument(src, 'test.qlang');
    const hover = hoverAtOffset(ast, src, 0);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/keyword/);
    expect(hover.content).toMatch(/:hello/);
  });

  it('hover has range', () => {
    const src = '[1 2 3] | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const hover = hoverAtOffset(ast, src, src.indexOf('count'));
    expect(hover).toHaveProperty('startOffset');
    expect(hover).toHaveProperty('endOffset');
    expect(hover.startOffset).toBeLessThan(hover.endOffset);
  });

  it('returns null for null ast', () => {
    expect(hoverAtOffset(null, '', 0)).toBeNull();
  });

  it('returns null for offset outside any node', () => {
    const src = '42';
    const { ast } = parseDocument(src, 'test.qlang');
    const hover = hoverAtOffset(ast, src, 100);
    expect(hover).toBeNull();
  });
});

describe('definitionAtOffset', () => {
  it('jumps from conduit use site to let declaration', () => {
    const src = 'let(:double, mul(2)) | 10 | double';
    const { ast } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('double');
    const def = definitionAtOffset(ast, useOffset);
    expect(def).not.toBeNull();
    // Definition should point at the let(:double, ...) OperandCall
    expect(def.startOffset).toBe(0);
  });

  it('returns null for builtin operands (no source declaration)', () => {
    const src = '[1 2 3] | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const def = definitionAtOffset(ast, src.indexOf('count'));
    expect(def).toBeNull();
  });

  it('returns null for non-OperandCall nodes', () => {
    const src = '42';
    const { ast } = parseDocument(src, 'test.qlang');
    const def = definitionAtOffset(ast, 0);
    expect(def).toBeNull();
  });

  it('returns null for null ast', () => {
    expect(definitionAtOffset(null, 0)).toBeNull();
  });
});

describe('referencesAtOffset', () => {
  it('finds all occurrences of a user-defined conduit', () => {
    const src = 'let(:double, mul(2)) | [1 2] * double';
    const { ast } = parseDocument(src, 'test.qlang');
    const refs = referencesAtOffset(ast, src.lastIndexOf('double'));
    // declaration (let(:double, ...)) + use site (... * double)
    expect(refs.length).toBe(2);
  });

  it('finds references from the declaration site', () => {
    const src = 'let(:x, 42) | x';
    const { ast } = parseDocument(src, 'test.qlang');
    // Click on :x inside let(:x, ...)
    const kwOffset = src.indexOf(':x') + 1; // inside the keyword
    const refs = referencesAtOffset(ast, kwOffset);
    expect(refs.length).toBe(2);
  });

  it('returns references for builtin operands', () => {
    const src = '[1 2 3] | count | add(1)';
    const { ast } = parseDocument(src, 'test.qlang');
    const refs = referencesAtOffset(ast, src.indexOf('count'));
    expect(refs.length).toBe(1);
  });

  it('returns empty for null ast', () => {
    expect(referencesAtOffset(null, 0)).toEqual([]);
  });
});

describe('documentSymbols', () => {
  it('collects let bindings as conduit symbols', () => {
    const src = 'let(:double, mul(2)) | let(:triple, mul(3))';
    const { ast } = parseDocument(src, 'test.qlang');
    const syms = documentSymbols(ast);
    expect(syms).toHaveLength(2);
    expect(syms[0].name).toBe('double');
    expect(syms[0].kind).toBe('conduit');
    expect(syms[1].name).toBe('triple');
    expect(syms[1].kind).toBe('conduit');
  });

  it('collects as bindings as snapshot symbols', () => {
    const src = '42 | as(:answer)';
    const { ast } = parseDocument(src, 'test.qlang');
    const syms = documentSymbols(ast);
    expect(syms).toHaveLength(1);
    expect(syms[0].name).toBe('answer');
    expect(syms[0].kind).toBe('snapshot');
  });

  it('returns empty for plain pipeline with no bindings', () => {
    const src = '[1 2 3] | count';
    const { ast } = parseDocument(src, 'test.qlang');
    expect(documentSymbols(ast)).toHaveLength(0);
  });

  it('returns empty for null ast', () => {
    expect(documentSymbols(null)).toEqual([]);
  });
});

describe('signatureHelpAtOffset', () => {
  it('returns signature for operand inside parens', () => {
    const src = '[1 2 3] | filter(gt(2))';
    const { ast } = parseDocument(src, 'test.qlang');
    // Cursor on the `g` of `gt` — narrowest OperandCall with args
    // is gt(2), not filter(...). The signature shows gt's contract.
    const offset = src.indexOf('gt');
    const sig = signatureHelpAtOffset(ast, src, offset);
    expect(sig).not.toBeNull();
    expect(sig.label).toMatch(/gt/);
  });

  it('returns null outside parens', () => {
    const src = '[1 2 3] | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const sig = signatureHelpAtOffset(ast, src, src.indexOf('count'));
    // count has no args (args === null), so no signature
    expect(sig).toBeNull();
  });

  it('tracks active parameter via comma counting', () => {
    const src = '{:x 1 :y 2} | add(/x, /y)';
    const { ast } = parseDocument(src, 'test.qlang');
    // Cursor after the comma, inside second arg
    const offset = src.indexOf('/y');
    const sig = signatureHelpAtOffset(ast, src, offset);
    expect(sig).not.toBeNull();
    expect(sig.activeParameter).toBe(1);
  });

  it('returns null for null ast', () => {
    expect(signatureHelpAtOffset(null, '', 0)).toBeNull();
  });
});
