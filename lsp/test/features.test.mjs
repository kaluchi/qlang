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
    const src = ':myVar 42 | myVar';
    const { ast } = parseDocument(src, 'test.qlang');
    const offsetAtEnd = src.length;
    const items = await completionsAtOffset(ast, offsetAtEnd);
    const labels = items.map(i => i.label);
    expect(labels).toContain('myVar');
  });

  it('user binding has variable kind', async () => {
    const src = ':myVar 42 | myVar';
    const { ast } = parseDocument(src, 'test.qlang');
    const items = await completionsAtOffset(ast, src.length);
    const myVarItem = items.find(i => i.label === 'myVar');
    expect(myVarItem.kind).toBe('variable');
  });

  it('works with null ast (parse failure)', async () => {
    const items = await completionsAtOffset(null, 0);
    expect(items.length).toBeGreaterThan(60);
  });

  it('mixed completions surface tag-namespace bindings alongside builtins', async () => {
    const src = 'foo';
    const { ast } = parseDocument(src, 'test.qlang');
    const items = await completionsAtOffset(ast, 3, src);
    expect(items.some(i => i.label === 'count')).toBe(true);
    expect(items.some(i => i.label === '::AddLeftNotNumberError')).toBe(true);
  });

  it('cursor right after `::` filters to tag-namespace only', async () => {
    const src = '::';
    const { ast } = parseDocument(src, 'test.qlang');
    const items = await completionsAtOffset(ast, 2, src);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(i => i.label.startsWith('::'))).toBe(true);
    expect(items.every(i => i.kind === 'tag')).toBe(true);
  });

  it('in-document `::Tag` BindStep contributes to tag-namespace completions', async () => {
    const src = '::MyTag {:qlang/kind :tag :qlang/impl ~{42}}';
    const { ast } = parseDocument(src, 'test.qlang');
    const items = await completionsAtOffset(ast, src.length, src);
    expect(items.some(i => i.label === '::MyTag')).toBe(true);
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
    expect(hover.content).toMatch(/container-reducer/);
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

  it('returns hover for BareTypeKeyword tag reference', async () => {
    const src = '::AddLeftNotNumberError | docs';
    const { ast } = parseDocument(src, 'test.qlang');
    const tagOffset = src.indexOf('::AddLeftNotNumberError') + 5;
    const hover = await hoverAtOffset(ast, src, tagOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/::AddLeftNotNumberError/);
    expect(hover.content).toMatch(/tag-binding/);
  });

  it('returns hover for TaggedLit constructor invocation', async () => {
    const src = '"x" | ::conduit[[] ~{mul(2)}]';
    const { ast } = parseDocument(src, 'test.qlang');
    const tagOffset = src.indexOf('::conduit') + 5;
    const hover = await hoverAtOffset(ast, src, tagOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/::conduit/);
    expect(hover.content).toMatch(/tag-binding/);
  });

  it('hover on ::Tag spans only the tag head, not the payload', async () => {
    const src = '"x" | ::conduit[[] ~{mul(2)}]';
    const { ast } = parseDocument(src, 'test.qlang');
    const tagOffset = src.indexOf('::conduit') + 5;
    const hover = await hoverAtOffset(ast, src, tagOffset);
    expect(hover).not.toBeNull();
    expect(hover.endOffset - hover.startOffset).toBe('::conduit'.length);
  });

  it('returns null for offset outside any node', async () => {
    const src = '42';
    const { ast } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(ast, src, 100);
    expect(hover).toBeNull();
  });
});

// Build a catalog context for definition fallback tests. Mirrors
// lib/qlang/core.qlang's BindStep series: each entry is
// `:name {...descriptor...}`, and `buildCatalogIndex` walks every
// `BindStep` node and records the entire BindStep span as the
// declaration site. The server merges each catalog file's source
// and URI onto every index entry so the goto handler can resolve
// offsets without re-reading the source — the test mirror does
// the same.
const catalogSrc = ':count {:category :vec-reducer}';
const catalogAst = parseDocument(catalogSrc, 'qlang/core').ast;
const testCatalogIndex = new Map();
for (const [name, range] of buildCatalogIndex(catalogAst)) {
  testCatalogIndex.set(name, {
    ...range,
    fileUri: 'file:///test/core.qlang',
    source: catalogSrc
  });
}
const testCatalogCtx = { index: testCatalogIndex };

describe('definitionAtOffset', () => {
  it('jumps from conduit use site to BindStep declaration', () => {
    const src = ':double mul(2) | 10 | double';
    const { ast } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('double');
    const def = definitionAtOffset(ast, useOffset);
    expect(def).not.toBeNull();
    expect(def.startOffset).toBe(0);
    expect(def.fileUri).toBeUndefined(); // in-document
  });

  it('jumps to last visible declaration when shadowed', () => {
    const src = ':x 1 | :x 2 | x';
    const { ast } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('x');
    const def = definitionAtOffset(ast, useOffset);
    expect(def).not.toBeNull();
    // Should point to the second `:x 2` BindStep, not the first.
    expect(def.startOffset).toBe(src.lastIndexOf(':x'));
  });

  it('declaration inside fork is invisible outside', () => {
    const src = '(:x 1) | x';
    const { ast } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('x');
    // x is declared inside a ParenGroup fork — invisible at the
    // use site. Falls through to catalog (none provided) or null.
    const def = definitionAtOffset(ast, useOffset);
    expect(def === null || def.fileUri !== undefined).toBe(true);
  });

  it('falls back to core.qlang catalog for builtin operands', () => {
    const src = '[1 2 3] | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const def = definitionAtOffset(ast, src.indexOf('count'), testCatalogCtx);
    expect(def).not.toBeNull();
    expect(def.fileUri).toBe('file:///test/core.qlang');
  });

  it('returns null without catalog context for builtins', () => {
    const src = '[1 2 3] | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const def = definitionAtOffset(ast, src.indexOf('count'));
    expect(def).toBeNull();
  });

  it('in-document BindStep shadows builtin — jumps to BindStep, not catalog', () => {
    const src = ':count 42 | count';
    const { ast } = parseDocument(src, 'test.qlang');
    const def = definitionAtOffset(ast, src.lastIndexOf('count'), testCatalogCtx);
    expect(def).not.toBeNull();
    expect(def.fileUri).toBeUndefined(); // in-document, not catalog
    expect(def.startOffset).toBe(0);
  });

  it('returns null for non-resolving nodes', () => {
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
    const src = ':double mul(2) | [1 2] * double';
    const { ast } = parseDocument(src, 'test.qlang');
    const refs = referencesAtOffset(ast, src.lastIndexOf('double'));
    // declaration (`:double …`) + use site (`* double`)
    expect(refs.length).toBe(2);
  });

  it('finds references from the declaration site', () => {
    const src = ':x 42 | x';
    const { ast } = parseDocument(src, 'test.qlang');
    // Click on :x in the BindStep key
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
  it('collects BindStep bindings as conduit symbols', () => {
    const src = ':double mul(2) :triple mul(3)';
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
