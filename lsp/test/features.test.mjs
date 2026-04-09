// Tests for LSP feature logic — pure functions, no LSP transport.

import { describe, it, expect } from 'vitest';
import { parseDocument, completionsAtOffset, hoverAtOffset } from '../src/features.mjs';

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
