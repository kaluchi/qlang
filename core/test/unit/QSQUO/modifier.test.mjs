import { describe, it, expect } from 'vitest';
import { createNotebook, evalQuery } from '../../../src/notebook.mjs';
import { makeTag, isErrorValue } from '../../../src/types.mjs';
import { BOX } from '../../helpers/box.mjs';

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function sessionRecordingVisits(visits) {
  return await createNotebook({ sources: [{
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
      const notebook = await sessionRecordingVisits(visits);
      const cell = await notebook.evalCell(query);
      expect(cell.defect).toBeNull();
      expect(visits).toEqual([['start', 3], ['end', 3], ['start', 2], ['end', 2], ['start', 1], ['end', 1]]);
    });
  }
});

it('a call hands on the error a modifier answers', async () => {
  expect(await evalQuery(BOX + '::Box[4 2] | put (get /missing) !| tag')).toEqual(makeTag('path/IndexNotIntegerError'));
});

it('computes the modifiers of a call up to the first that answers an error, and runs none after it', async () => {
  let noted = 0;
  const notebook = await createNotebook({
    sources: [{ uri: 'probe/note', source: ':any/note ::builtin{}', primitives: { 'any/note': subject => { noted += 1; return subject; } } }]
  });
  expect((await notebook.evalCell('[1 2] | query (get /nope) ("ran" | note) !| tag')).result).toEqual(makeTag('path/IndexNotIntegerError'));
  expect(noted).toBe(0);
});

it('`tag` hands on an error its modifier answers', async () => {
  const err = await evalQuery('42 | tag ("not-a-number" | add 1)');
  expect(isErrorValue(err)).toBe(true);
  expect(err.tag).toEqual(makeTag('number/add/SubjectNotNumberError'));
});

it('a tag a vector holds beside a value is read through the name `with` gives it', async () => {
  // [QSNUM#combine]
  const r = await evalQuery('[42 ::Box] | with {:t ~(get /1)} ~(get /0 | tag t) | tag');
  expect(r).toEqual(makeTag('Box'));
});
