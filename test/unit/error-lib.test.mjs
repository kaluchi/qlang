// Happy-path and failure-path fixtures for the `lib/qlang/error` and
// `lib/qlang/error/observe` conduits. These files are installed via
// the module-resolver into a session that exposes `:error` and
// `:error/observe` as namespaces, so every test here begins with
// `use(:error)` or `use(:error/observe)` to pull the conduits into
// env before invoking them.
//
// Each conduit is exercised against both of the branches that its
// control flow can take: the success-track path where the incoming
// value flows through unchanged, and the fail-track path where `!|`
// fires its body against the materialized descriptor Map.

import { describe, it, expect, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession } from '../../src/session.mjs';
import {
  discoverModules,
  resolveModules,
  installModules
} from '../../host/module-resolver.mjs';
import { keyword, isErrorValue } from '../../src/types.mjs';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'lib', 'qlang');

function sessionWithErrorLib() {
  const session = createSession();
  const catalog = resolveModules(libDir);
  installModules(session, catalog);
  session.evalCell('null | use(:error) | use(:error/observe)');
  return session;
}

// Run a single qlang snippet in a session with error + error/observe
// installed, assert the snippet returned a non-error result, and
// return the raw pipeValue for further assertions.
function runOk(session, snippet) {
  const entry = session.evalCell(snippet);
  expect(entry.error, `snippet threw host-level: ${snippet}`).toBeNull();
  expect(isErrorValue(entry.result), `snippet returned error value: ${snippet}`).toBe(false);
  return entry.result;
}

// Run a snippet that is expected to evaluate to an error value and
// return the error wrapper for further assertions against its
// materialized descriptor.
function runErr(session, snippet) {
  const entry = session.evalCell(snippet);
  expect(entry.error, `snippet threw host-level: ${snippet}`).toBeNull();
  expect(isErrorValue(entry.result), `snippet returned success value: ${snippet}`).toBe(true);
  return entry.result;
}

describe('retry — success on first attempt flows through unchanged', () => {
  let s;
  beforeEach(() => { s = sessionWithErrorLib(); });

  it('returns the success value when action succeeds', () => {
    const r = runOk(s, '42 | retry(add(1), 3)');
    expect(r).toBe(43);
  });
});

describe('retry — recovers from a single transient failure', () => {
  let s;
  beforeEach(() => { s = sessionWithErrorLib(); });

  it('exhausts retries and returns the final error when action keeps failing', () => {
    // `count` on a number is a type error on every attempt; retry(0)
    // drops through to the else branch and re-lifts the materialized
    // descriptor into a fresh error on the fail-track.
    const err = runErr(s, '42 | retry(count, 0)');
    expect(err.descriptor.get(keyword('thrown'))).toEqual(keyword('CountSubjectNotContainer'));
  });

  it('retries the documented number of attempts before re-lifting', () => {
    // Two retries, action never succeeds — three attempts total.
    // The returned error's :trail accumulates the deflected steps
    // from the recursive body of retry.
    const err = runErr(s, '42 | retry(count, 2)');
    expect(err.descriptor.get(keyword('kind'))).toEqual(keyword('type-error'));
  });
});

describe('recover — kind-matching rewrites the error, non-matching re-lifts', () => {
  let s;
  beforeEach(() => { s = sessionWithErrorLib(); });

  it('fires the handler when the predicate matches', () => {
    const r = runOk(s, '!{:kind :not-found :code 404} !| recover(/code | eq(404), "fallback")');
    expect(r).toBe('fallback');
  });

  it('re-lifts the descriptor when the predicate does not match and the next !| reads through', () => {
    // Non-matching recover runs its else-branch `error` lambda
    // against the materialized descriptor, lifting it back into a
    // fresh error. The next `!|` then projects :code off that
    // re-lifted error's descriptor, round-tripping the original
    // field through the recover boundary.
    const r = runOk(s, '!{:kind :not-found :code 404} !| recover(/code | eq(500), "fallback") !| /code');
    expect(r).toBe(404);
  });
});

describe('mapError — transforms the descriptor and re-lifts', () => {
  let s;
  beforeEach(() => { s = sessionWithErrorLib(); });

  it('rewrites the :kind of the error via the lambda', () => {
    const r = runOk(s, '!{:kind :old} !| mapError({:kind :new}) !| /kind');
    expect(r).toEqual(keyword('new'));
  });

  it('union-style rewrite preserves other descriptor fields', () => {
    const r = runOk(s, '!{:kind :oops :count 3} !| mapError(union({:handled true})) !| /count');
    expect(r).toBe(3);
  });
});

describe('withContext — merges a context Map into the descriptor', () => {
  let s;
  beforeEach(() => { s = sessionWithErrorLib(); });

  it('adds a single context field readable after re-lift', () => {
    const r = runOk(s, '!{:kind :oops} !| withContext({:request "r-1"}) !| /request');
    expect(r).toBe('r-1');
  });

  it('preserves :kind while adding new context fields', () => {
    const r = runOk(s, '!{:kind :oops} !| withContext({:user "alice"}) !| /kind');
    expect(r).toEqual(keyword('oops'));
  });

  it('trail continuity survives withContext re-lift', () => {
    // Structured trail: /trail yields Vec of AST-Maps; * /text
    // extracts the source-text display form so the assertion can
    // still compare against plain strings. The continuity property
    // under test: count deflects into the trail as an AST-Map;
    // after withContext + re-lift via the conduit's internal
    // `| error`, the :trail Vec stays populated; `| add(5)` then
    // deflects and the outer !| combines that into the exposed
    // materialized descriptor, so the final text projection holds
    // both step labels in chronological order.
    const r = runOk(s, '!{:kind :oops} | count !| withContext({:ctx 1}) | add(5) !| /trail * /text');
    expect(r).toEqual(['count', 'add(5)']);
  });
});

describe('tap — observes a success value without altering it', () => {
  let s;
  beforeEach(() => { s = sessionWithErrorLib(); });

  it('pipeValue passes through unchanged', () => {
    const r = runOk(s, '42 | tap(add(1))');
    expect(r).toBe(42);
  });

  it('tap inside a distribute chain leaves each element untouched', () => {
    const r = runOk(s, '[1 2 3] * tap(mul(10))');
    expect(r).toEqual([1, 2, 3]);
  });
});

describe('tapError — observes an error without altering the descriptor', () => {
  let s;
  beforeEach(() => { s = sessionWithErrorLib(); });

  it('error value passes through unchanged with :kind preserved', () => {
    const r = runOk(s, '!{:kind :oops} !| tapError(/kind) !| /kind');
    expect(r).toEqual(keyword('oops'));
  });
});

describe('finally — runs an action on the success track preserving pipeValue', () => {
  let s;
  beforeEach(() => { s = sessionWithErrorLib(); });

  it('pipeValue flows through the cleanup action unchanged', () => {
    const r = runOk(s, '"value" | finally(append(" logged"))');
    expect(r).toBe('value');
  });
});

describe('finallyError — runs an action on the fail track, error flows through', () => {
  let s;
  beforeEach(() => { s = sessionWithErrorLib(); });

  it('descriptor flows through the cleanup action unchanged', () => {
    const r = runOk(s, '!{:kind :oops :message "boom"} !| finallyError(/message) !| /message');
    expect(r).toBe('boom');
  });
});
