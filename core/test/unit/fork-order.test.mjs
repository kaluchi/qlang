// The forks of a sequence run in its order [D84]. A pure pipeline cannot
// observe the order, so a word of a host that records its calls
// does: each element's call finishes before the next one begins, though
// the first element waits the longest.

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/session.mjs';

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function sessionRecordingVisits(visits) {
  return await createSession({ sources: [{
    uri: 'probe',
    source: ':any/@visit ::builtin{}',
    impls: {
      'any/@visit': async element => {
        visits.push(['start', element]);
        await pause(element);
        visits.push(['end', element]);
        return element;
      }
    }
  }] });
}

describe('the forks of a sequence run in its order [D84]', () => {
  for (const [label, query] of [
    ['the elements under `map` over a vector', '[3 2 1] | map ~@visit'],
    ['the values under `map` over a map', '{:a 3 :b 2 :c 1} | map ~@visit'],
    ['the elements of a vector literal', '[(3 | @visit) (2 | @visit) (1 | @visit)]'],
    ['the keys of `sort`', '[3 2 1] | sort ~(@visit)'],
  ]) {
    it(label, async () => {
      const visits = [];
      const session = await sessionRecordingVisits(visits);
      const cell = await session.evalCell(query);
      expect(cell.error).toBeNull();
      expect(visits).toEqual([['start', 3], ['end', 3], ['start', 2], ['end', 2], ['start', 1], ['end', 1]]);
    });
  }
});
