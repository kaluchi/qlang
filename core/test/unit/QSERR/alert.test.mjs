import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { boundAnswer } from '../../../src/runtime/print.mjs';
import { ROOM_OF_A_FACT, ROOM_OF_AN_ALERT } from '../../../src/rooms.mjs';

const isExcerpt = value => value instanceof Map && printValue(value).startsWith('::excerpt{');
const alertOf = async query => boundAnswer(await evalQuery(query), await langRuntime());

describe('a host prints a failure as the concentrate of its facts', () => {
  it('prints a failure whose facts fit whole as its error at rest', async () => {
    const failure = await evalQuery('"x" | add 1');
    const alert = await alertOf('"x" | add 1');
    expect([[...alert.facts.keys()], printValue(alert).startsWith('::number/add/SubjectNotNumberError!{')]).toEqual([[...failure.facts.keys()], true]);
  });

  it('prints a failure a fact of which gave way as the excerpt of its refusal, the fact the excerpt its tag gives', async () => {
    const alert = await alertOf('1 | add (3410 | range)');
    const refused = alert.facts.get('actualValue');
    expect([printValue(alert).startsWith('::number/add/addend/KindNotTakenError::excerpt{'), isExcerpt(refused), refused.get('count'), printValue(refused).length <= ROOM_OF_A_FACT]).toEqual([true, true, 3410, true]);
  });

  it('tells a trace by the steps that failed, the paths of the parts and the subject the step met', async () => {
    const trace = (await alertOf('10 | range | map ~(get {:name "Bo" :age 41 :email "bo@example.org" :city "Amsterdam" :tags ["a" "b"]}) | map ~(get /address/country)')).facts.get('trace');
    expect([printValue(trace.get('failed')), printValue(trace.get('paths')), trace.get('subject').get('name')]).toEqual(['[~(get /address/country) ~(map ~(get /address/country))]', '[/0]', 'Bo']);
  });

  it('drops its last facts where the alert passes its room', async () => {
    const facts = Array.from({ length: 12 }, (_, at) => `:f${at} ${JSON.stringify('x'.repeat(250))}`).join(' ');
    const alert = await alertOf(`!{${facts}} | raise`);
    const kept = [...alert.facts.keys()];
    expect([printValue(alert).length <= ROOM_OF_AN_ALERT, kept.length < 12, kept[0]]).toEqual([true, true, 'f0']);
  });
});

describe('the excerpt of a refusal read back', () => {
  it('answers the facts by their names, its tag the refusal\'s', async () => {
    const alert = await alertOf('kinds | add 1');
    expect(await evalQuery(`${printValue(alert)} | get [~(tag) ~(actualTag) ~(trace | get /failed)]`)).toEqual(await evalQuery('[::number/add/SubjectNotNumberError ::set [~(add 1)]]'));
  });

  it('is refused by raise, which raises no excerpt', async () => {
    const alert = await alertOf('kinds | add 1');
    expect((await evalQuery(`${printValue(alert)} | raise !| tag`)).name).toBe('any/raise/SubjectKindNotTakenError');
  });

  it('holds its facts whole beneath !|', async () => {
    expect(await evalQuery('1 | add (3410 | range) !| actualValue | count')).toBe(3410);
  });
});
