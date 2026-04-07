// Assemble the langRuntime — the initial environment Map every
// query starts with. Each entry is a built-in function value (or
// pseudo-operand for `env`).
//
// Env keys are interned keyword objects (see types.mjs::keyword)
// so the env Map interoperates uniformly with Map literals,
// `has`, `keys`, `vals`, and `/key` projection.

import { keyword } from '../types.mjs';
import * as vec from './vec.mjs';
import * as map from './map.mjs';
import * as setMod from './set.mjs';
import * as setops from './setops.mjs';
import * as arith from './arith.mjs';
import * as predicates from './predicates.mjs';
import { env as envOperand } from './intro.mjs';

function bind(target, name, value) {
  target.set(keyword(name), value);
}

// langRuntime() — returns a fresh env Map populated with all
// built-in operands. A new Map per call so callers can layer
// their own bindings without leaking across queries.
export function langRuntime() {
  const m = new Map();

  // Vec operands
  bind(m, 'count',    vec.count);
  bind(m, 'empty',    vec.empty);
  bind(m, 'first',    vec.first);
  bind(m, 'last',     vec.last);
  bind(m, 'sum',      vec.sum);
  bind(m, 'min',      vec.min);
  bind(m, 'max',      vec.max);
  bind(m, 'filter',   vec.filter);
  bind(m, 'sort',     vec.sort);
  bind(m, 'take',     vec.take);
  bind(m, 'drop',     vec.drop);
  bind(m, 'distinct', vec.distinct);
  bind(m, 'reverse',  vec.reverse);
  bind(m, 'flat',     vec.flat);

  // Map operands
  bind(m, 'keys', map.keys);
  bind(m, 'vals', map.vals);
  bind(m, 'has',  map.has);

  // Set operands
  bind(m, 'set', setMod.set);

  // Polymorphic set operations (bound form)
  bind(m, 'union', setops.union);
  bind(m, 'minus', setops.minus);
  bind(m, 'inter', setops.inter);

  // Arithmetic
  bind(m, 'add', arith.add);
  bind(m, 'sub', arith.sub);
  bind(m, 'mul', arith.mul);
  bind(m, 'div', arith.div);

  // Predicates
  bind(m, 'eq',  predicates.eq);
  bind(m, 'gt',  predicates.gt);
  bind(m, 'lt',  predicates.lt);
  bind(m, 'gte', predicates.gte);
  bind(m, 'lte', predicates.lte);
  bind(m, 'and', predicates.and);
  bind(m, 'or',  predicates.or);
  bind(m, 'not', predicates.not);

  // Introspection
  bind(m, 'env', envOperand);

  return m;
}
