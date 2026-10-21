// The values the doors of a host are held to [QSHST#door]: a value of each kind of
// the language, which passes both doors as it is, and each value of no kind
// beside the path where it stands and what the walk of the door names it by.

import { evalQuery } from '../../src/session.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { nodeOf } from '../../src/nouns.mjs';
import { makeSet } from '../../src/ordering.mjs';
import {
  keyword, makeTag, makeTagged, makeDoc, makePath, makeRegex, makeErrorValue, bindingValueOf, stampTagHeader
} from '../../src/types.mjs';

export async function valuesOfTheLanguage() {
  const root = await langRuntime();
  return [
    null, undefined, [1, undefined, 3], true, 'text', 42, -0.5, keyword('k'), makeTag('T'), makePath(['a', '0']), makeRegex('a+', 'i'),
    [1, [2]], new Map([['a', 1]]), makeSet([1, 2]), makeTagged(makeTag('Box'), 5), makeTagged(makeTag('Box'), [1]),
    makeTagged(makeTag('Box'), new Map([['w', 2]])), makeDoc([' a page ']), await evalQuery('~(add 1)'),
    await evalQuery('!{:a 1}'), await evalQuery('::trace[::frame[1 ~(add 1)]]'),
    bindingValueOf(nodeOf(root, 'number/add')), bindingValueOf(nodeOf(root, 'number')), nodeOf(root, 'number/add')
  ];
}

export function valuesOfNoKind() {
  const looped = [1];
  looped.push(looped);
  const selfish = new Map([['a', 1]]);
  selfish.set('self', [selfish]);
  const holed = [1];
  holed[2] = 3;
  const shadowedVector = [function leaked() {}];
  shadowedVector.entries = function* entries() {};
  const shadowedMap = new Map([[1, 'a']]);
  shadowedMap.keys = function* keys() {};
  const boxedVector = [1];
  stampTagHeader(boxedVector, 'Box');
  const boxedMap = new Map([['a', 1]]);
  stampTagHeader(boxedMap, 'Box');
  const stampedObject = { a: 1 };
  stampTagHeader(stampedObject, makeTag('Box'));
  return [
    [function hello() {}, '', 'function hello'],
    [[() => 1][0], '', 'function'],
    [{ a: 1 }, '', 'object Object'],
    [Object.create(null), '', 'object null'],
    [new Date(0), '', 'object Date'],
    [new Set([1]), '', 'object Set'],
    [stampedObject, '', 'object Object'],
    [Infinity, '', 'number Infinity'],
    [-Infinity, '', 'number -Infinity'],
    [NaN, '', 'number NaN'],
    [5n, '', 'bigint 5'],
    [Symbol('s'), '', 'symbol Symbol(s)'],
    [new Map([[1, 'a']]), '', 'a map whose key number 1 is no string'],
    [new Map([['a', 1], [undefined, 2]]), '', 'a map whose key undefined is no string'],
    [boxedVector, '', 'a vector whose tag string Box is no tag'],
    [boxedMap, '', 'a map whose tag string Box is no tag'],
    [makeTagged('Box', 5), '', 'a value whose tag string Box is no tag'],
    [makeErrorValue('Late', new Map([['by', 3]])), '', 'an error whose tag string Late is no tag'],
    [looped, '/1', 'a vector that holds itself'],
    [selfish, '/self/0', 'a map that holds itself'],
    [holed, '/1', 'a hole of a vector'],
    [shadowedVector, '/0', 'function leaked'],
    [shadowedMap, '', 'a map whose key number 1 is no string'],
    [makeErrorValue(makeTag('error'), [['a', 1]]), '', 'an error whose facts object Array are no map'],
    [makeErrorValue(makeTag('error'), null), '', 'an error whose facts null are no map'],
    [[1, new Map([['a', [function hi() {}]]])], '/1/a/0', 'function hi'],
    [makeTagged(makeTag('Box'), [makeSet([1]), { x: 1 }]), '/1', 'object Object'],
    [makeErrorValue(makeTag('error'), new Map([['bad', -Infinity]])), '/bad', 'number -Infinity'],
    [[new Map([['k', new Map([[2, 0]])]])], '/0/k', 'a map whose key number 2 is no string']
  ];
}
