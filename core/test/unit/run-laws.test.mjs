// runLaws — run each law declared under a name as an executable test
// case [D174]. A law passes when it answers `true`. The subject is a keyword (binding name) or a tag name, the
// address of a verb among them, so `::qlang | manifest * manifest |
// flat * runLaws` walks the whole catalog.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, isQSet, makeTagKeyword } from '../../src/types.mjs';
import { createSession } from '../../src/session.mjs';

describe('runLaws reads a name as laws does', () => {
  it('address subject — ::vec/count | runLaws', async () => {
    const result = await evalQuery('::vec/count | runLaws * /ok | distinct');
    expect(isQSet(result)).toBe(true);
    expect([...result]).toEqual([true]);
  });

  it('a binding without a doc runs no law, its page null', async () => {
    // A host-installed binding (via `session.bind`) is the record of a
    // binding without a doc [D63].
    const sessionInstance = await createSession();
    sessionInstance.bind('hostInjected', 42);
    const cellEntry = await sessionInstance.evalCell(':hostInjected | runLaws');
    expect(cellEntry.result).toEqual([]);
    const pageEntry = await sessionInstance.evalCell(':hostInjected | doc');
    expect(pageEntry.result).toBeNull();
  });

  it('a name that names no binding is refused as doc refuses it', async () => {
    const refusal = await evalQuery(':nothingBound | runLaws');
    expect(refusal.tag).toEqual(makeTagKeyword('keyword/runLaws/UnknownNameError'));
  });

  it('the keyword of a verb a provider keeps hands on its addresses', async () => {
    const addresses = await evalQuery(':count | runLaws !| /addresses');
    expect([...addresses].map(address => address.name).sort()).toEqual(['map/count', 'set/count', 'string/count', 'vec/count']);
  });

  it('a tag name that names nothing is refused under the tag it read', async () => {
    const bindingName = await evalQuery('::Nonexistent | runLaws !| /name');
    expect(bindingName).toEqual(makeTagKeyword('Nonexistent'));
  });

  it('a subject no kind of which answers the word is refused where the word is looked up', async () => {
    const err = await evalQuery('42 | runLaws');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('call/KindAnswersNoVerbError'));
  });
});

describe('runLaws Quote-as-test outcomes', () => {
  it('a law that lifts an error → ok:false with error message', async () => {
    const moduleSource = ':demo 1\n:demo/broken |~~ A broken law. ~~| ::law~("x" | prepend 42 | eq 42)';
    const session = await createSession({
      sources: [{ uri: 'tests/source', source: moduleSource }]
    });
    const cellEntry = await session.evalCell(':demo | runLaws | first');
    expect(cellEntry.result.get('ok')).toBe(false);
    expect(typeof cellEntry.result.get('error')).toBe('string');
  });

  it('a law that answers false → ok:false with no error', async () => {
    // 5 | mul(2) = 10, eq(99) = false. The law ran cleanly but
    // answered false, so runLaws reports ok:false with :error nil —
    // there is no error message, the claim just did not hold.
    const moduleSource = ':demo 1\n:demo/falsy |~~ A false claim. ~~| ::law~(5 | mul 2 | eq 99)';
    const session = await createSession({
      sources: [{ uri: 'tests/source', source: moduleSource }]
    });
    const cellEntry = await session.evalCell(':demo | runLaws | first');
    expect(cellEntry.result.get('ok')).toBe(false);
    expect(cellEntry.result.get('error')).toBeNull();
    expect(cellEntry.result.get('actual')).toBe(false);
  });

  it('a law that answers true → ok:true', async () => {
    const moduleSource = ':demo 1\n:demo/truthy ::law~(5 | mul 2 | eq 10)';
    const session = await createSession({
      sources: [{ uri: 'tests/source', source: moduleSource }]
    });
    const cellEntry = await session.evalCell(':demo | runLaws | first | /ok');
    expect(cellEntry.result).toBe(true);
  });

  it('a binding without a doc in its slot returns an empty Vec', async () => {
    const session = await createSession({
      sources: [{ uri: 'tests/source', source: ':bare 42' }]
    });
    const cellEntry = await session.evalCell(':bare | runLaws | count');
    expect(cellEntry.result).toBe(0);
  });

  it('a law sees the names of the calling session', async () => {
    // A law runs in the scope of the session that asked for it, so a
    // name a source of the root declared resolves there [D14].
    const moduleSource = ':fortytwo 1\n:fortytwo/addsUp |~~ Tracks the scope through runLaws. ~~| ::law~(40 | add 2 | eq 42)';
    const session = await createSession({
      sources: [{ uri: 'tests/source', source: moduleSource }]
    });
    const cellEntry = await session.evalCell(
      ':fortytwo | runLaws | first | /ok');
    expect(cellEntry.result).toBe(true);
  });

  it('example does not leak BindStep writes back into the calling session', async () => {
    // The law under `:writer` runs a BindStep — the session-env copy
    // isolates the write so the calling session still sees no
    // `:scratch` after runLaws completes. Reading `:scratch` on the
    // session after `runLaws` therefore lifts ::call/UnknownNameError.
    const moduleSource = ':writer 1\n:writer/declares |~~ Declares a name of its own. ~~| ::law~(:scratch 99 | scratch | eq 99)';
    const session = await createSession({
      sources: [{ uri: 'tests/source', source: moduleSource }]
    });
    const cellRun = await session.evalCell(
      ':writer | runLaws | first | /ok');
    expect(cellRun.result).toBe(true);
    const cellProbe = await session.evalCell('scratch');
    expect(isErrorValue(cellProbe.result)).toBe(true);
    expect(cellProbe.result.tag)
      .toEqual(makeTagKeyword('call/UnknownNameError'));
  });

  it('a law that lifts a user-built error → :error reads :message from descriptor', async () => {
    // User-built errors (via `raise(map)` operand) carry no
    // `.originalError` on the JS-level ErrorValue wrapper —
    // `errorMessageOf` falls through to the descriptor's :message
    // entry. Distinct from finding #41's "Quote that lifts an error"
    // case where the JS throw routed through `errorFromQlang` and
    // the wrapper retained `.originalError`.
    const moduleSource = ':demo 1\n:demo/raises |~~ A user-built error. ~~| ::law~({:message "hand-built failure" :kind :test} | raise)';
    const session = await createSession({
      sources: [{ uri: 'tests/source', source: moduleSource }]
    });
    const cellEntry = await session.evalCell(':demo | runLaws | first');
    expect(cellEntry.result.get('ok')).toBe(false);
    expect(cellEntry.result.get('error')).toBe('hand-built failure');
  });
});
