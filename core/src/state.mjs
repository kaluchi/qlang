// State pair (pipeValue, env) accessors and immutable updaters.
//
// State is meta-notation: it lives only inside the evaluator.
// Users never see or construct it. Within the evaluator we model
// it as a frozen object with two fields. Every step returns a
// fresh State carrying the next pipeValue or the next env; the
// previous State stays observable to ancestor frames so fork
// boundaries can discard inner-env writes without copying.
//
// The env is a JS Map whose keys are plain strings (identifier
// names). Identifier lookup passes the name string directly.

// makeState(pipeValue, env) → State
export function makeState(pipeValue, env) {
  return Object.freeze({ pipeValue, env });
}

// withPipeValue(state, nextPipeValue) → new State
export function withPipeValue(state, nextPipeValue) {
  return makeState(nextPipeValue, state.env);
}

// envGet(env, name) → value or undefined
export function envGet(env, name) {
  return env.get(name);
}

// envHas(env, name) → boolean
export function envHas(env, name) {
  return env.has(name);
}

// envSet(env, name, value) → new env Map
export function envSet(env, name, value) {
  return new Map(env).set(name, value);
}

// envMerge(env, otherMap) → new env Map
export function envMerge(env, otherMap) {
  const next = new Map(env);
  for (const [key, value] of otherMap) next.set(key, value);
  return next;
}
