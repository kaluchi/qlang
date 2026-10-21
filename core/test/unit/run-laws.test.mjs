// runLaws runs each law declared under a name [QSSLF#laws], a law passing
// where it answers `true`, its subject a tag name, the address of a verb
// among them, or a value, which runs the laws of its kind.

import { describe, it, expect } from 'vitest';
import { createSession, evalQuery } from '../../src/session.mjs';
import { isErrorValue, makeTag, makeBinding, keyword } from '../../src/types.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';

describe('runLaws reads a name as laws does', () => {
  it('a binding no declaration wrote runs no law and reads no page', async () => {
    // A binding no declaration wrote, in a scope a host hands a session,
    // holds no doc [QSNAM#binding].
    const scope = new Map(await langRuntime()).set('hostInjected', makeBinding({ name: keyword('hostInjected'), value: 42 }));
    const sessionInstance = await createSession({ scope });
    const cellEntry = await sessionInstance.evalCell('::hostInjected | runLaws');
    expect(cellEntry.result).toEqual([]);
    const pageEntry = await sessionInstance.evalCell('::hostInjected | doc');
    expect(pageEntry.result).toBeNull();
  });

  it('the tag of a name several kinds answer is refused with their addresses', async () => {
    const addresses = await evalQuery('::count | runLaws !| get /addresses');
    expect([...addresses].map(address => address.name).sort()).toEqual(['map/count', 'string/count', 'vec/count']);
  });

  it('a value runs the laws of its kind, as doc reads its page [QSSLF#laws]', async () => {
    const results = await evalQuery('42 | runLaws');
    expect(isErrorValue(results)).toBe(false);
    expect(results.map(result => result.get('law').name)).toEqual((await evalQuery('::number | runLaws')).map(result => result.get('law').name));
  });
});

describe('the outcome of each law', () => {
  it('a name a source declares with no law under it runs none', async () => {
    const session = await createSession({
      sources: [{ uri: 'tests/source', source: ':bare 42' }]
    });
    const cellEntry = await session.evalCell('::bare | runLaws | count');
    expect(cellEntry.result).toBe(0);
  });

  it('a law a source of the root declares runs from a cell', async () => {
    // A law the root declares runs in a lane over the root alone, which a
    // cell's runLaws reaches [QSQUO#held].
    const moduleSource = ':fortytwo 1\n:fortytwo/addsUp |~~ Tracks the scope through runLaws. ~~| ::law~(40 | add 2 | eq 42)';
    const session = await createSession({
      sources: [{ uri: 'tests/source', source: moduleSource }]
    });
    const cellEntry = await session.evalCell(
      '::fortytwo | runLaws | first | get /ok');
    expect(cellEntry.result).toBe(true);
  });

  it('a law does not leak the writes of a declaration back into the calling session', async () => {
    // The law under `:writer` declares `:scratch` in a scope of its own, so
    // the session reads no `scratch` after it ran.
    const moduleSource = ':writer 1\n:writer/declares |~~ Declares a name of its own. ~~| ::law~(:scratch 99 | scratch | eq 99)';
    const session = await createSession({
      sources: [{ uri: 'tests/source', source: moduleSource }]
    });
    const cellRun = await session.evalCell(
      '::writer | runLaws | first | get /ok');
    expect(cellRun.result).toBe(true);
    const cellProbe = await session.evalCell('scratch');
    expect(isErrorValue(cellProbe.result)).toBe(true);
    expect(cellProbe.result.tag)
      .toEqual(makeTag('call/UnknownNameError'));
  });

  it('a law that raises a map holds it at rest as its :error, its :message among its facts [QSSLF#laws]', async () => {
    // A map raised is an error of the kind of errors, and the law's
    // result holds it at rest as `!|` grounds it, every entry of the
    // map a fact.
    const moduleSource = ':demo 1\n:demo/raises |~~ A user-built error. ~~| ::law~({:message "hand-built failure" :kind :test} | raise)';
    const session = await createSession({
      sources: [{ uri: 'tests/source', source: moduleSource }]
    });
    const cellEntry = await session.evalCell('::demo | runLaws | first');
    expect(cellEntry.result.get('ok')).toBe(false);
    expect(cellEntry.result.get('error').get('message')).toBe('hand-built failure');
  });
});
