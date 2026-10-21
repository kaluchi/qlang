import { describe, it, expect } from 'vitest';
import { createSession, evalQuery } from '../../../src/session.mjs';
import { makeTag, isErrorValue } from '../../../src/types.mjs';
import { BOX } from '../../helpers/box.mjs';

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function sessionRecordingVisits(visits) {
  return await createSession({ sources: [{
    uri: 'probe',
    source: ':any/visit ::builtin{}',
    primitives: {
      'any/visit': async element => {
        visits.push(['start', element]);
        await pause(element);
        visits.push(['end', element]);
        return element;
      }
    }
  }] });
}

describe('the forks of a sequence run in its order', () => {
  for (const [label, query] of [
    ['the elements under `map` over a vector', '[3 2 1] | map ~visit'],
    ['the values under `map` over a map', '{:a 3 :b 2 :c 1} | map ~visit'],
    ['the elements of a vector literal', 'get [~(3 | visit) ~(2 | visit) ~(1 | visit)]'],
    ['the keys of `sort`', '[3 2 1] | sort ~(visit)'],
  ]) {
    it(`${label}`, async () => {
      const visits = [];
      const session = await sessionRecordingVisits(visits);
      const cell = await session.evalCell(query);
      expect(cell.defect).toBeNull();
      expect(visits).toEqual([['start', 3], ['end', 3], ['start', 2], ['end', 2], ['start', 1], ['end', 1]]);
    });
  }
});

describe('the args of a call', () => {
  it('hands on the error a modifier answers', async () => {
    expect(await evalQuery(BOX + '::Box[4 2] | put (get /missing) !| type')).toEqual(makeTag('path/IndexNotIntegerError'));
  });
});

describe('a host\'s primitive under a label', () => {
  it('computes the modifiers of a call up to the first that answers an error, and runs none after it', async () => {
    let noted = 0;
    const session = await createSession({
      sources: [{ uri: 'probe/note', source: ':any/note ::builtin{}', primitives: { 'any/note': subject => { noted += 1; return subject; } } }]
    });
    expect((await session.evalCell('[1 2] | query (get /nope) ("ran" | note) !| type')).result).toEqual(makeTag('path/IndexNotIntegerError'));
    expect(noted).toBe(0);
  });
});

describe('what `tag` hands on', () => {
  it('tag hands on an error its modifier answers', async () => {
    const err = await evalQuery('42 | tag ("not-a-number" | add 1)');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTag('number/add/SubjectNotNumberError'));
  });
});

describe('the tag `tag` lays is computed against the value in the pipe', () => {
  it('a tag a vector holds beside a value is read through a name of the vector', async () => {
    // The subject of a call is the value in the pipe [QSNUM#combine], so the pair is named before its value takes the tag it holds.
    const r = await evalQuery('[42 ::Box] | :pair it | get /0 | tag (pair | get /1) | type');
    expect(r).toEqual(makeTag('Box'));
  });
});
