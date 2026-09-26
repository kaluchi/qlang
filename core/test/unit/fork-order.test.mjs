// The forks of a sequence run in its order [D84]. A pure pipeline cannot
// observe the order, so an operand of a host that records its calls
// does: each element's call finishes before the next one begins, though
// the first element waits the longest.

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/session.mjs';

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function sessionRecordingVisits(visits) {
  const session = await createSession({
    locator: async namespaceName => namespaceName === 'probe' ? {
      source: ':@visit ::verb~(::builtin{:impl :probe/@visit})',
      impls: {
        '@visit': async element => {
          visits.push(['start', element]);
          await pause(element);
          visits.push(['end', element]);
          return element;
        }
      }
    } : null
  });
  await session.evalCell('use :probe');
  return session;
}

describe('the forks of a sequence run in its order [D84]', () => {
  for (const [label, query] of [
    ['the elements under `*` over a vector', '[3 2 1] * @visit'],
    ['the values under `*` over a map', '{:a 3 :b 2 :c 1} * @visit'],
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
