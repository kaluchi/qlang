// Tests for LSP feature logic — pure functions, no LSP transport.

import { describe, it, expect } from 'vitest';
import {
  parseDocument, buildCatalogIndex, completionsAtOffset,
  hoverAtOffset, definitionAtOffset, referencesAtOffset,
  documentSymbols, signatureHelpAtOffset
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
  it('includes builtin operand names', async () => {
    const { ast } = parseDocument('', 'test.qlang');
    const items = await completionsAtOffset(ast, 0);
    const labels = items.map(i => i.label);
    expect(labels).toContain('count');
    expect(labels).toContain('filter');
    expect(labels).toContain('add');
    expect(labels).toContain('let');
    expect(labels).toContain('as');
    expect(labels).toContain('reify');
  });

  it('returns more than 60 builtin completions', async () => {
    const { ast } = parseDocument('', 'test.qlang');
    const items = await completionsAtOffset(ast, 0);
    expect(items.length).toBeGreaterThan(60);
  });

  it('builtins have function kind', async () => {
    const { ast } = parseDocument('', 'test.qlang');
    const items = await completionsAtOffset(ast, 0);
    const countItem = items.find(i => i.label === 'count');
    expect(countItem.kind).toBe('function');
  });

  it('builtins have documentation from manifest', async () => {
    const { ast } = parseDocument('', 'test.qlang');
    const items = await completionsAtOffset(ast, 0);
    const countItem = items.find(i => i.label === 'count');
    expect(countItem.documentation).toBeTruthy();
    expect(countItem.documentation).toMatch(/number of elements/);
  });

  it('includes user-defined bindings visible at offset', async () => {
    const src = 'let(:myVar, 42) | myVar';
    const { ast } = parseDocument(src, 'test.qlang');
    const offsetAtEnd = src.length;
    const items = await completionsAtOffset(ast, offsetAtEnd);
    const labels = items.map(i => i.label);
    expect(labels).toContain('myVar');
  });

  it('user binding has variable kind', async () => {
    const src = 'let(:myVar, 42) | myVar';
    const { ast } = parseDocument(src, 'test.qlang');
    const items = await completionsAtOffset(ast, src.length);
    const myVarItem = items.find(i => i.label === 'myVar');
    expect(myVarItem.kind).toBe('variable');
  });

  it('works with null ast (parse failure)', async () => {
    const items = await completionsAtOffset(null, 0);
    expect(items.length).toBeGreaterThan(60);
  });
});

describe('hoverAtOffset', () => {
  it('returns hover for a builtin operand', async () => {
    const src = '[1 2 3] | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const countOffset = src.indexOf('count');
    const hover = await hoverAtOffset(ast, src, countOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/count/);
    expect(hover.content).toMatch(/vec-reducer/);
  });

  it('hover includes docs from manifest', async () => {
    const src = '[1 2 3] | filter(gt(2))';
    const { ast } = parseDocument(src, 'test.qlang');
    const filterOffset = src.indexOf('filter');
    const hover = await hoverAtOffset(ast, src, filterOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/predicate/i);
  });

  it('returns hover for a projection', async () => {
    const src = '{:name "alice"} | /name';
    const { ast } = parseDocument(src, 'test.qlang');
    const projOffset = src.indexOf('/name');
    const hover = await hoverAtOffset(ast, src, projOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/projection/);
    expect(hover.content).toMatch(/\/name/);
  });

  it('returns hover for a keyword literal', async () => {
    const src = ':hello';
    const { ast } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(ast, src, 0);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/keyword/);
    expect(hover.content).toMatch(/:hello/);
  });

  it('hover has range', async () => {
    const src = '[1 2 3] | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(ast, src, src.indexOf('count'));
    expect(hover).toHaveProperty('startOffset');
    expect(hover).toHaveProperty('endOffset');
    expect(hover.startOffset).toBeLessThan(hover.endOffset);
  });

  it('returns null for null ast', async () => {
    expect(await hoverAtOffset(null, '', 0)).toBeNull();
  });

  it('returns null for offset outside any node', async () => {
    const src = '42';
    const { ast } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(ast, src, 100);
    expect(hover).toBeNull();
  });
});

// Build a catalog context for definition fallback tests. Mirrors
// lib/qlang/core.qlang's outer-MapLit shape: each entry is a
// `:name {...descriptor...}` pair, and `buildCatalogIndex` walks
// for MapEntry nodes to record the entry span as the def site.
const catalogSrc = '{:count {:category :vec-reducer}}';
const catalogAst = parseDocument(catalogSrc, 'qlang/core').ast;
const testCatalogCtx = {
  uri: 'file:///test/core.qlang',
  index: buildCatalogIndex(catalogAst)
};

describe('definitionAtOffset', () => {
  it('jumps from conduit use site to let declaration', () => {
    const src = 'let(:double, mul(2)) | 10 | double';
    const { ast } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('double');
    const def = definitionAtOffset(ast, useOffset);
    expect(def).not.toBeNull();
    expect(def.startOffset).toBe(0);
    expect(def.uri).toBeNull(); // in-document
  });

  it('jumps to last visible declaration when shadowed', () => {
    const src = 'let(:x, 1) | let(:x, 2) | x';
    const { ast } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('x');
    const def = definitionAtOffset(ast, useOffset);
    expect(def).not.toBeNull();
    // Should point to second let(:x, 2), not the first
    expect(def.startOffset).toBe(src.indexOf('let(:x, 2)'));
  });

  it('declaration inside fork is invisible outside', () => {
    const src = '(let(:x, 1)) | x';
    const { ast } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('x');
    // x is declared inside a ParenGroup fork — invisible at the
    // use site. Falls through to manifest or null.
    const def = definitionAtOffset(ast, useOffset);
    expect(def === null || def.uri !== null).toBe(true);
  });

  it('falls back to core.qlang catalog for builtin operands', () => {
    const src = '[1 2 3] | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const def = definitionAtOffset(ast, src.indexOf('count'), testCatalogCtx);
    expect(def).not.toBeNull();
    expect(def.uri).toBe('file:///test/core.qlang');
  });

  it('returns null without catalog context for builtins', () => {
    const src = '[1 2 3] | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const def = definitionAtOffset(ast, src.indexOf('count'));
    expect(def).toBeNull();
  });

  it('in-document let shadows builtin — jumps to let, not catalog', () => {
    const src = 'let(:count, 42) | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const def = definitionAtOffset(ast, src.lastIndexOf('count'), testCatalogCtx);
    expect(def).not.toBeNull();
    expect(def.uri).toBeNull(); // in-document, not catalog
    expect(def.startOffset).toBe(0);
  });

  it('returns null for non-OperandCall nodes', () => {
    const src = '42';
    const { ast } = parseDocument(src, 'test.qlang');
    expect(definitionAtOffset(ast, 0)).toBeNull();
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
  it('returns signature for operand inside parens', async () => {
    const src = '[1 2 3] | filter(gt(2))';
    const { ast } = parseDocument(src, 'test.qlang');
    // Cursor on the `g` of `gt` — narrowest OperandCall with args
    // is gt(2), not filter(...). The signature shows gt's contract.
    const offset = src.indexOf('gt');
    const sig = await signatureHelpAtOffset(ast, src, offset);
    expect(sig).not.toBeNull();
    expect(sig.label).toMatch(/gt/);
  });

  it('returns null outside parens', async () => {
    const src = '[1 2 3] | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const sig = await signatureHelpAtOffset(ast, src, src.indexOf('count'));
    // count has no args (args === null), so no signature
    expect(sig).toBeNull();
  });

  it('tracks active parameter via comma counting', async () => {
    const src = '{:x 1 :y 2} | add(/x, /y)';
    const { ast } = parseDocument(src, 'test.qlang');
    // Cursor after the comma, inside second arg
    const offset = src.indexOf('/y');
    const sig = await signatureHelpAtOffset(ast, src, offset);
    expect(sig).not.toBeNull();
    expect(sig.activeParameter).toBe(1);
  });

  it('returns null for null ast', async () => {
    expect(await signatureHelpAtOffset(null, '', 0)).toBeNull();
  });
});
