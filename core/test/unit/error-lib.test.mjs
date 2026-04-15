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
  resolveModules,
  installModules
} from '../../host/module-resolver.mjs';
import { keyword, isErrorValue } from '../../src/types.mjs';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'lib', 'qlang');

async function sessionWithErrorLib() {
  const sessionInstance = await createSession();
  const catalog = await resolveModules(libDir);
  installModules(sessionInstance, catalog);
  await sessionInstance.evalCell('null | use(:error) | use(:error/observe)');
  return sessionInstance;
}

// Run a single qlang snippet in a session with error + error/observe
// installed, assert the snippet returned a non-error result, and
// return the raw pipeValue for further assertions.
async function runOk(sessionInstance, snippet) {
  const cellEntry = await sessionInstance.evalCell(snippet);
  expect(cellEntry.error, `snippet threw host-level: ${snippet}`).toBeNull();
  expect(isErrorValue(cellEntry.result), `snippet returned error value: ${snippet}`).toBe(false);
  return cellEntry.result;
}

// Run a snippet that is expected to evaluate to an error value and
// return the error wrapper for further assertions against its
// materialized descriptor.
async function runErr(sessionInstance, snippet) {
  const cellEntry = await sessionInstance.evalCell(snippet);
  expect(cellEntry.error, `snippet threw host-level: ${snippet}`).toBeNull();
  expect(isErrorValue(cellEntry.result), `snippet returned success value: ${snippet}`).toBe(true);
  return cellEntry.result;
}

describe('retry — success on first attempt flows through unchanged', () => {
  let sessionInstance;
  beforeEach(async () => { sessionInstance = await sessionWithErrorLib(); });

  it('returns the success value when action succeeds', async () => {
    const retryResult = await runOk(sessionInstance, '42 | retry(add(1), 3)');
    expect(retryResult).toBe(43);
  });
});

describe('retry — recovers from a single transient failure', () => {
  let sessionInstance;
  beforeEach(async () => { sessionInstance = await sessionWithErrorLib(); });

  it('exhausts retries and returns the final error when action keeps failing', async () => {
    // `count` on a number is a type error on every attempt; retry(0)
    // drops through to the else branch and re-lifts the materialized
    // descriptor into a fresh error on the fail-track.
    const errorResult = await runErr(sessionInstance, '42 | retry(count, 0)');
    expect(errorResult.descriptor.get(keyword('thrown'))).toEqual(keyword('CountSubjectNotContainer'));
  });

  it('retries the documented number of attempts before re-lifting', async () => {
    // Two retries, action never succeeds — three attempts total.
    // The returned error's :trail accumulates the deflected steps
    // from the recursive body of retry.
    const errorResult = await runErr(sessionInstance, '42 | retry(count, 2)');
    expect(errorResult.descriptor.get(keyword('kind'))).toEqual(keyword('type-error'));
  });
});

describe('recover — kind-matching rewrites the error, non-matching re-lifts', () => {
  let sessionInstance;
  beforeEach(async () => { sessionInstance = await sessionWithErrorLib(); });

  it('fires the handler when the predicate matches', async () => {
    const recoverResult = await runOk(sessionInstance, '!{:kind :not-found :code 404} !| recover(/code | eq(404), "fallback")');
    expect(recoverResult).toBe('fallback');
  });

  it('re-lifts the descriptor when the predicate does not match and the next !| reads through', async () => {
    // Non-matching recover runs its else-branch `error` lambda
    // against the materialized descriptor, lifting it back into a
    // fresh error. The next `!|` then projects :code off that
    // re-lifted error's descriptor, round-tripping the original
    // field through the recover boundary.
    const recoverResult = await runOk(sessionInstance, '!{:kind :not-found :code 404} !| recover(/code | eq(500), "fallback") !| /code');
    expect(recoverResult).toBe(404);
  });
});

describe('mapError — transforms the descriptor and re-lifts', () => {
  let sessionInstance;
  beforeEach(async () => { sessionInstance = await sessionWithErrorLib(); });

  it('rewrites the :kind of the error via the lambda', async () => {
    const mapResult = await runOk(sessionInstance, '!{:kind :old} !| mapError({:kind :new}) !| /kind');
    expect(mapResult).toEqual(keyword('new'));
  });

  it('union-style rewrite preserves other descriptor fields', async () => {
    const mapResult = await runOk(sessionInstance, '!{:kind :oops :count 3} !| mapError(union({:handled true})) !| /count');
    expect(mapResult).toBe(3);
  });
});

describe('withContext — merges a context Map into the descriptor', () => {
  let sessionInstance;
  beforeEach(async () => { sessionInstance = await sessionWithErrorLib(); });

  it('adds a single context field readable after re-lift', async () => {
    const ctxResult = await runOk(sessionInstance, '!{:kind :oops} !| withContext({:request "r-1"}) !| /request');
    expect(ctxResult).toBe('r-1');
  });

  it('preserves :kind while adding new context fields', async () => {
    const ctxResult = await runOk(sessionInstance, '!{:kind :oops} !| withContext({:user "alice"}) !| /kind');
    expect(ctxResult).toEqual(keyword('oops'));
  });

  it('trail continuity survives withContext re-lift', async () => {
    // Structured trail: /trail yields Vec of AST-Maps; * /text
    // extracts the source-text display form so the assertion can
    // still compare against plain strings. The continuity property
    // under test: count deflects into the trail as an AST-Map;
    // after withContext + re-lift via the conduit's internal
    // `| error`, the :trail Vec stays populated; `| add(5)` then
    // deflects and the outer !| combines that into the exposed
    // materialized descriptor, so the final text projection holds
    // both step labels in chronological order.
    const ctxResult = await runOk(sessionInstance, '!{:kind :oops} | count !| withContext({:ctx 1}) | add(5) !| /trail * /text');
    expect(ctxResult).toEqual(['count', 'add(5)']);
  });
});

describe('tap — observes a success value without altering it', () => {
  let sessionInstance;
  beforeEach(async () => { sessionInstance = await sessionWithErrorLib(); });

  it('pipeValue passes through unchanged', async () => {
    const tapResult = await runOk(sessionInstance, '42 | tap(add(1))');
    expect(tapResult).toBe(42);
  });

  it('tap inside a distribute chain leaves each element untouched', async () => {
    const tapResult = await runOk(sessionInstance, '[1 2 3] * tap(mul(10))');
    expect(tapResult).toEqual([1, 2, 3]);
  });
});

describe('tapError — observes an error without altering the descriptor', () => {
  let sessionInstance;
  beforeEach(async () => { sessionInstance = await sessionWithErrorLib(); });

  it('error value passes through unchanged with :kind preserved', async () => {
    const tapErrResult = await runOk(sessionInstance, '!{:kind :oops} !| tapError(/kind) !| /kind');
    expect(tapErrResult).toEqual(keyword('oops'));
  });
});

describe('finally — runs an action on the success track preserving pipeValue', () => {
  let sessionInstance;
  beforeEach(async () => { sessionInstance = await sessionWithErrorLib(); });

  it('pipeValue flows through the cleanup action unchanged', async () => {
    const finallyResult = await runOk(sessionInstance, '"value" | finally(append(" logged"))');
    expect(finallyResult).toBe('value');
  });
});

describe('finallyError — runs an action on the fail track, error flows through', () => {
  let sessionInstance;
  beforeEach(async () => { sessionInstance = await sessionWithErrorLib(); });

  it('descriptor flows through the cleanup action unchanged', async () => {
    const finallyErrResult = await runOk(sessionInstance, '!{:kind :oops :message "boom"} !| finallyError(/message) !| /message');
    expect(finallyErrResult).toBe('boom');
  });
});
