// Tests for walk.mjs — AST traversal primitives.

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import {
  astChildrenOf,
  walkAst,
  assignAstNodeIds,
  attachAstParents,
  findAstNodeAtOffset,
  findIdentifierOccurrences,
  bindingNamesVisibleAt,
  astNodeSpan,
  astNodeContainsOffset,
  triviaBetweenAstNodes
} from '../../src/walk.mjs';

describe('astChildrenOf', () => {
  it('yields steps for a Pipeline', () => {
    const ast = parse('[1 2 3] | count');
    expect(ast.type).toBe('Pipeline');
    const children = astChildrenOf(ast);
    expect(children).toHaveLength(2);
    expect(children[0].type).toBe('VecLit');
    expect(children[1].type).toBe('OperandCall');
    expect(children[1].name).toBe('count');
  });

  it('yields elements for a VecLit', () => {
    const ast = parse('[10 20 30]');
    const children = astChildrenOf(ast);
    expect(children).toHaveLength(3);
    expect(children.map(c => c.value)).toEqual([10, 20, 30]);
  });

  it('yields entries for a MapLit and key/value for each MapEntry', () => {
    const ast = parse('{:name "Alice" :age 30}');
    const entries = astChildrenOf(ast);
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('MapEntry');
    const keyAndValue = astChildrenOf(entries[0]);
    expect(keyAndValue).toHaveLength(2);
    expect(keyAndValue[0].type).toBe('Keyword');
    expect(keyAndValue[0].name).toBe('name');
  });

  it('yields the body for a LetStep', () => {
    const ast = parse('let double = mul(2)');
    const children = astChildrenOf(ast);
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe('OperandCall');
    expect(children[0].name).toBe('mul');
  });

  it('yields the inner pipeline for a ParenGroup', () => {
    const ast = parse('(mul(2) | add(1))');
    const children = astChildrenOf(ast);
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe('Pipeline');
  });

  it('returns an empty array for leaf node types', () => {
    expect(astChildrenOf({ type: 'NumberLit', value: 42 })).toEqual([]);
    expect(astChildrenOf({ type: 'StringLit', value: 's' })).toEqual([]);
    expect(astChildrenOf({ type: 'Keyword', name: 'k' })).toEqual([]);
    expect(astChildrenOf({ type: 'Projection', keys: ['a'] })).toEqual([]);
    expect(astChildrenOf({ type: 'AsStep', name: 'x' })).toEqual([]);
  });

  it('returns empty array for non-AST values', () => {
    expect(astChildrenOf(null)).toEqual([]);
    expect(astChildrenOf(undefined)).toEqual([]);
    expect(astChildrenOf(42)).toEqual([]);
    expect(astChildrenOf({})).toEqual([]);
  });

  it('yields args for an OperandCall and nothing for a bare ident', () => {
    const withArgs = parse('add(2, 3)');
    expect(astChildrenOf(withArgs)).toHaveLength(2);
    const bare = parse('count');
    expect(astChildrenOf(bare)).toEqual([]);
  });
});

describe('walkAst', () => {
  it('visits every AST node in pre-order', () => {
    const ast = parse('[1 2] | add(3)');
    const visited = [];
    walkAst(ast, (node) => visited.push(node.type));
    expect(visited).toContain('Pipeline');
    expect(visited).toContain('VecLit');
    expect(visited).toContain('NumberLit');
    expect(visited).toContain('OperandCall');
  });

  it('skips children when visitor returns false', () => {
    const ast = parse('[1 2] | add(3)');
    const visited = [];
    walkAst(ast, (node) => {
      visited.push(node.type);
      if (node.type === 'VecLit') return false;
    });
    // Inside VecLit we should not have descended.
    expect(visited.filter(t => t === 'NumberLit')).toHaveLength(1); // only the 3 in add(3)
  });

  it('passes the parent to the visitor', () => {
    const ast = parse('[1 2 3]');
    const parentTypes = new Map();
    walkAst(ast, (node, parent) => {
      if (parent) parentTypes.set(node.type, parent.type);
    });
    expect(parentTypes.get('NumberLit')).toBe('VecLit');
  });
});

describe('assignAstNodeIds and attachAstParents', () => {
  it('assigns sequential ids in pre-order via parse()', () => {
    const ast = parse('[1 2 3]');
    expect(ast.id).toBe(0);
    expect(ast.elements[0].id).toBe(1);
    expect(ast.elements[1].id).toBe(2);
    expect(ast.elements[2].id).toBe(3);
  });

  it('attaches parent pointers via parse()', () => {
    const ast = parse('[1 2 3]');
    expect(ast.parent).toBeNull();
    expect(ast.elements[0].parent).toBe(ast);
    expect(ast.elements[1].parent).toBe(ast);
  });

  it('manual assignAstNodeIds resets the counter', () => {
    const ast = parse('[1 2]');
    assignAstNodeIds(ast);
    expect(ast.id).toBe(0);
  });

  it('manual attachAstParents recomputes parents', () => {
    const ast = parse('count');
    attachAstParents(ast);
    expect(ast.parent).toBeNull();
  });
});

describe('findAstNodeAtOffset', () => {
  it('returns null when offset is outside any node', () => {
    const ast = parse('[1 2 3]');
    expect(findAstNodeAtOffset(ast, 999)).toBeNull();
  });

  it('returns the narrowest node containing the offset', () => {
    const source = '[1 2 3] | filter(gt(2))';
    //              0123456789012345678901234
    //                       111111111122222
    // offset 19 lands inside `gt(2)` which is the narrowest
    const ast = parse(source);
    const node = findAstNodeAtOffset(ast, 19);
    expect(node).not.toBeNull();
    expect(node.type).toBe('OperandCall');
    expect(node.name).toBe('gt');
  });

  it('returns the leaf at the start of a number literal', () => {
    const source = '42';
    const ast = parse(source);
    const node = findAstNodeAtOffset(ast, 0);
    expect(node.type).toBe('NumberLit');
    expect(node.value).toBe(42);
  });
});

describe('findIdentifierOccurrences', () => {
  it('finds OperandCall occurrences of a name', () => {
    const ast = parse('count | add(count)');
    const refs = findIdentifierOccurrences(ast, 'count');
    expect(refs.length).toBeGreaterThanOrEqual(2);
    expect(refs.every(n => n.type === 'OperandCall' && n.name === 'count')).toBe(true);
  });

  it('finds LetStep declaration alongside read sites', () => {
    const ast = parse('let double = mul(2) | double');
    const refs = findIdentifierOccurrences(ast, 'double');
    const types = refs.map(r => r.type).sort();
    expect(types).toContain('LetStep');
    expect(types).toContain('OperandCall');
  });

  it('finds Projection segments by name', () => {
    const ast = parse('/foo/bar | count');
    const refs = findIdentifierOccurrences(ast, 'foo');
    expect(refs.length).toBeGreaterThanOrEqual(1);
    expect(refs[0].type).toBe('Projection');
  });

  it('does not include keyword literals', () => {
    const ast = parse(':foo');
    const refs = findIdentifierOccurrences(ast, 'foo');
    expect(refs).toHaveLength(0);
  });
});

describe('bindingNamesVisibleAt', () => {
  it('returns previously declared let names visible at the cursor', () => {
    const source = 'let x = 1\n| let y = 2\n| z';
    const ast = parse(source);
    const visible = bindingNamesVisibleAt(ast, source.length);
    expect(visible.has('x')).toBe(true);
    expect(visible.has('y')).toBe(true);
  });

  it('does not include bindings that are still ahead of the cursor', () => {
    const source = 'let early = 1 | here | let late = 2';
    const ast = parse(source);
    // Cursor inside the `here` operand call: 'early' visible, 'late' not
    const visible = bindingNamesVisibleAt(ast, 18);
    expect(visible.has('early')).toBe(true);
    expect(visible.has('late')).toBe(false);
  });

  it('includes as bindings', () => {
    const source = '42 | as answer | answer';
    const ast = parse(source);
    const visible = bindingNamesVisibleAt(ast, source.length);
    expect(visible.has('answer')).toBe(true);
  });

  it('hides bindings whose enclosing ParenGroup has already closed', () => {
    const source = '(let local = 1 | local) | here';
    //              012345678901234567890123456789
    //                        1111111111222222222
    const ast = parse(source);
    // Cursor at "here", well past the closing paren of the group.
    const cursorAtHere = source.indexOf('here');
    const visible = bindingNamesVisibleAt(ast, cursorAtHere);
    expect(visible.has('local')).toBe(false);
  });

  it('still sees a binding while inside its enclosing ParenGroup', () => {
    const source = '(let local = 1 | local | other)';
    const ast = parse(source);
    const cursorAtOther = source.indexOf('other');
    const visible = bindingNamesVisibleAt(ast, cursorAtOther);
    expect(visible.has('local')).toBe(true);
  });

  it('hides bindings inside one Vec element from a sibling element', () => {
    const source = '[let x = 1, x]';
    //              0123456789012345
    const ast = parse(source);
    // The bare `x` reference is the second element. Cursor at offset
    // of that bare `x` should NOT see the let binding from element 1.
    const cursorAtSecondX = source.lastIndexOf('x');
    const visible = bindingNamesVisibleAt(ast, cursorAtSecondX);
    expect(visible.has('x')).toBe(false);
  });

  it('hides bindings inside one Map entry value from a sibling entry value', () => {
    const source = '{:a let x = 1 :b x}';
    const ast = parse(source);
    const cursorAtSecondX = source.lastIndexOf('x');
    const visible = bindingNamesVisibleAt(ast, cursorAtSecondX);
    expect(visible.has('x')).toBe(false);
  });

  it('top-level binding remains visible inside any number of nested forks', () => {
    const source = 'let outer = 1 | (([{:k outer}]))';
    const ast = parse(source);
    const cursorAtInnerOuter = source.lastIndexOf('outer');
    const visible = bindingNamesVisibleAt(ast, cursorAtInnerOuter);
    expect(visible.has('outer')).toBe(true);
  });
});

describe('astNodeSpan and astNodeContainsOffset', () => {
  it('astNodeSpan equals end.offset - start.offset', () => {
    const ast = parse('42');
    expect(astNodeSpan(ast)).toBe(2);
  });

  it('astNodeSpan returns +Infinity for nodes without location', () => {
    expect(astNodeSpan({ type: 'Synth' })).toBe(Number.POSITIVE_INFINITY);
  });

  it('astNodeContainsOffset is half-open [start, end)', () => {
    const ast = parse('hello');
    expect(astNodeContainsOffset(ast, 0)).toBe(true);
    expect(astNodeContainsOffset(ast, 4)).toBe(true);
    expect(astNodeContainsOffset(ast, 5)).toBe(false); // end excluded
  });

  it('astNodeContainsOffset returns false for nodes without location', () => {
    expect(astNodeContainsOffset({ type: 'Synth' }, 0)).toBe(false);
  });
});

describe('findAstNodeAtOffset / findIdentifierOccurrences edge cases', () => {
  it('findAstNodeAtOffset skips synthesized nodes that lack a location', () => {
    // Build a synth Pipeline whose direct child is a real parsed
    // node (with location) and another child is synthesized (no
    // location). The walker should skip the synth and only consider
    // the real one.
    const realChild = parse('42'); // NumberLit with location at [0, 2)
    const synthRoot = {
      type: 'Pipeline',
      steps: [
        realChild,
        { combinator: '|', step: { type: 'NumberLit', value: 99 } } // synth, no location
      ],
      location: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 100, line: 1, column: 101 } }
    };
    const node = findAstNodeAtOffset(synthRoot, 1);
    expect(node).toBe(realChild);
  });

  it('findIdentifierOccurrences finds an AsStep declaration', () => {
    const ast = parse('42 | as snapshot | snapshot');
    const refs = findIdentifierOccurrences(ast, 'snapshot');
    const types = refs.map(r => r.type).sort();
    expect(types).toContain('AsStep');
    expect(types).toContain('OperandCall');
  });
});

describe('triviaBetweenAstNodes', () => {
  it('returns the source slice between two adjacent steps', () => {
    const source = '42  |  count';
    //              012345678901
    const ast = parse(source);
    const head = ast.steps[0];
    const tail = ast.steps[1].step;
    const trivia = triviaBetweenAstNodes(head, tail, ast);
    expect(trivia).toBe('  |  ');
  });

  it('returns empty string when nodes lack location', () => {
    expect(triviaBetweenAstNodes({}, {}, { source: 'x' })).toBe('');
  });
});
