// Polymorphic set operations: union, minus, inter.
//
// Bound form only (arity 2): left | union(right). The bare-form
// fold over a Vec of operands is documented in the runtime spec
// but not yet implemented — it requires a polymorphic-arity
// dispatch that the current Rule 10 does not natively model.
// Users can left-fold manually for now; bare form will arrive
// when a `reduce` primitive lands.
//
// Type dispatch:
//   Set × Set      → Set
//   Map × Map      → Map (union: last wins; minus: M1 ∖ keys(M2);
//                         inter: M1 ∩ keys(M2))
//   Map × Set      → Map (key-set semantics)

import { valueOp } from './dispatch.mjs';
import { TypeError as QTypeError } from '../errors.mjs';
import { isQMap, isKeyword, describeType } from '../types.mjs';

function isQSet(v) { return v instanceof Set; }

function unionPair(left, right) {
  if (isQSet(left) && isQSet(right)) {
    const out = new Set(left);
    for (const v of right) out.add(v);
    return out;
  }
  if (isQMap(left) && isQMap(right)) {
    const out = new Map(left);
    for (const [k, v] of right) out.set(k, v);
    return out;
  }
  throw new QTypeError(
    `union: incompatible types (${describeType(left)}, ${describeType(right)})`
  );
}

function minusPair(left, right) {
  if (isQSet(left) && isQSet(right)) {
    const out = new Set();
    for (const v of left) if (!right.has(v)) out.add(v);
    return out;
  }
  if (isQMap(left) && isQMap(right)) {
    const out = new Map();
    for (const [k, v] of left) if (!right.has(k)) out.set(k, v);
    return out;
  }
  if (isQMap(left) && isQSet(right)) {
    const out = new Map();
    for (const [k, v] of left) {
      if (!isKeyword(k) || !right.has(k)) out.set(k, v);
    }
    return out;
  }
  throw new QTypeError(
    `minus: incompatible types (${describeType(left)}, ${describeType(right)})`
  );
}

function interPair(left, right) {
  if (isQSet(left) && isQSet(right)) {
    const out = new Set();
    for (const v of left) if (right.has(v)) out.add(v);
    return out;
  }
  if (isQMap(left) && isQMap(right)) {
    const out = new Map();
    for (const [k, v] of left) if (right.has(k)) out.set(k, v);
    return out;
  }
  if (isQMap(left) && isQSet(right)) {
    const out = new Map();
    for (const [k, v] of left) {
      if (isKeyword(k) && right.has(k)) out.set(k, v);
    }
    return out;
  }
  throw new QTypeError(
    `inter: incompatible types (${describeType(left)}, ${describeType(right)})`
  );
}

export const union = valueOp('union', 2, unionPair);
export const minus = valueOp('minus', 2, minusPair);
export const inter = valueOp('inter', 2, interPair);
