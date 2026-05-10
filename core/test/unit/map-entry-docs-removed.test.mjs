// MapEntryDocPrefix grammar rule has been removed; doc-comment
// prefixes are no longer attached as MapEntry metadata. This file
// pins the new contract: a doc-comment ahead of a MapEntry key,
// Vec element, or Set element is a parse error inside a literal
// body. The pipeline-position attachment path
// (DocAttachedSequence) restricts to def / as only.

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.mjs';
import { evalQuery } from '../../src/eval.mjs';
import { keyword } from '../../src/types.mjs';

describe('doc-prefix inside MapEntry literal is a parse error', () => {
  it('rejects a doc-comment ahead of a MapEntry key', () => {
    expect(() => parse('{|~~ doc ~~| :k 1}')).toThrow();
  });
});

describe('DocLit literal is a Vec / Set element by itself', () => {
  it('a Doc-value at the head of a Vec is its first element', async () => {
    const result = await evalQuery('[|~~ doc ~~| 42] | first | isDoc');
    expect(result).toBe(true);
  });
});

describe('DocAttachedSequence restricts to def / as only', () => {
  it('attaches a doc-prefix to a def call', async () => {
    const result = await evalQuery('|~~ note ~~| def(:x, 42) | reify(:x) | /docs');
    expect(result).toEqual([' note ']);
  });

  it('attaches a doc-prefix to an as call', async () => {
    const result = await evalQuery('42 | |~~ note ~~| as(:x) | reify(:x) | /docs');
    expect(result).toEqual([' note ']);
  });

  it('a doc-prefix ahead of a non-def/as operand chain explicitly with `|`', async () => {
    // After Phase 3 the doc-prefix attaches only to def / as.
    // For other operands the author must chain explicitly with `|`,
    // making the Doc-value a separate pipeline step that filter
    // then operates on as its subject.
    const result = await evalQuery('|~~ inline note ~~| | filter(gt(0)) !| /thrown');
    expect(result).toEqual(keyword('FilterSubjectNotContainer'));
  });
});

describe('MapEntry no longer carries .docs in the AST', () => {
  it('parses MapEntry without a docs field', () => {
    const ast = parse('{:k 1}');
    expect(ast.entries[0].docs).toBeUndefined();
  });
});
