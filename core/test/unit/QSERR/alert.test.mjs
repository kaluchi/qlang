import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { boundAnswer } from '../../../src/runtime/print.mjs';
import { ROOM_OF_AN_ALERT } from '../../../src/rooms.mjs';

const keeping = () => {
  const kept = [];
  const keep = async value => {
    kept.push(value);
    return await evalQuery(`::cell"kept${kept.length}"`);
  };
  return { kept, keep };
};

const alertOf = async (query, keep = null) => boundAnswer(await evalQuery(query), await langRuntime(), null, keep);

describe('a host prints a failure as the concentrate of its facts', () => {
  it('prints a failure whose facts fit whole as its error at rest', async () => {
    const failure = await evalQuery('"x" | add 1');
    const alert = await alertOf('"x" | add 1');
    expect([[...alert.facts.keys()], printValue(alert).startsWith('::number/add/SubjectNotNumberError!{')]).toEqual([[...failure.facts.keys()], true]);
  });

  it('holds a fact past the room of a fact as the cell its host keeps it in, beside the views of its kind that fit', async () => {
    const { kept, keep } = keeping();
    const alert = await alertOf('1 | add (3410 | range)', keep);
    expect([printValue(alert).startsWith('::number/add/addend/KindNotTakenError::excerpt{'), [...alert.facts.keys()], printValue(alert.facts.get('addend/found')), alert.facts.get('addend/found/count'), kept[0].length])
      .toEqual([true, ['subject/found', 'addend/expected', 'addend/found', 'addend/found/count', 'addend/found/shape', 'addend/found/first', 'addend/found/last', 'trace'], '::cell"kept1"', 3410, 3410]);
  });

  it('tells a fact past the room by its views alone where its host keeps no cell', async () => {
    expect([...(await alertOf('1 | add (3410 | range)')).facts.keys()]).toEqual(['subject/found', 'addend/expected', 'addend/found/count', 'addend/found/shape', 'addend/found/first', 'addend/found/last', 'trace']);
  });

  it('shows the views of a trace past the room that fit, a view that answers nothing left out', async () => {
    const { keep } = keeping();
    const alert = await alertOf('kinds | add 1', keep);
    expect([[...alert.facts.keys()], printValue(alert.facts.get('trace/failed'))]).toEqual([['subject/expected', 'subject/found', 'subject/found/count', 'subject/found/shape', 'subject/found/first', 'subject/found/last', 'trace', 'trace/failed'], '[~(add 1)]']);
  });

  it('drops its last facts where the alert passes its room', async () => {
    const facts = Array.from({ length: 12 }, (_, at) => `:f${at} ${JSON.stringify('x'.repeat(250))}`).join(' ');
    const alert = await alertOf(`!{${facts}} | raise`);
    const kept = [...alert.facts.keys()];
    expect([printValue(alert).length <= ROOM_OF_AN_ALERT, kept.length < 12, kept[0], printValue(alert).startsWith('::error::excerpt{')]).toEqual([true, true, 'f0', true]);
  });
});

describe('the excerpt of a refusal read back', () => {
  it('answers the facts by their names, a cell among them, its tag the refusal\'s', async () => {
    const { keep } = keeping();
    const alert = await alertOf('kinds | add 1', keep);
    expect(await evalQuery(`${printValue(alert)} | get [~(tag) ~(subject | found | tag) ~(payload | get /:subject/found/count | eq (kinds | count)) ~(trace | tag) ~(payload | get /:trace/failed)]`)).toEqual(await evalQuery('[::number/add/SubjectNotNumberError ::cell true ::cell [~(add 1)]]'));
  });

  it('is refused by raise, which raises no excerpt', async () => {
    const { keep } = keeping();
    const alert = await alertOf('kinds | add 1', keep);
    expect((await evalQuery(`${printValue(alert)} | raise !| tag`)).name).toBe('any/raise/SubjectKindNotTakenError');
  });

  it('holds its facts whole beneath !|', async () => {
    expect(await evalQuery('1 | add (3410 | range) !| addend | found | count')).toBe(3410);
  });
});
