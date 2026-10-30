import { describe, it, expect } from 'vitest';
import * as core from '../../../src/index.mjs';
import { evalQuery, createNotebook } from '../../../src/notebook.mjs';
import { fromJsonText, fromPlain, toPlain } from '../../../src/runtime/json.mjs';
import { makeSet } from '../../../src/ordering.mjs';
import { makeBinding, makeKeyword, makeTag, makeTagged } from '../../../src/types.mjs';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';

it('a value crosses into JSON and back', () => {
  const lifted = core.fromPlain({ name: 'alice' });
  expect(core.toPlain(lifted)).toEqual({ name: 'alice' });
});

describe('a number of JSON past the doubles', () => {
  it('lifts an out-of-range magnitude into a per-site codec error, with no path where it is the whole text', async () => {
    const { StringParseJsonNumberNotFiniteError } = await import('../../../src/runtime/json.mjs');
    let thrown = null;
    try { fromPlain(JSON.parse('1e400')); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(StringParseJsonNumberNotFiniteError);
    expect(thrown.address).toBe('string/parseJson/NumberNotFiniteError');
    expect(thrown.facts.path).toBeUndefined();
  });

  it('names the path it read to when the magnitude sits nested', async () => {
    const { StringParseJsonNumberNotFiniteError } = await import('../../../src/runtime/json.mjs');
    let thrown = null;
    try { fromPlain(JSON.parse('{"a": {"b": [1, 1e400]}}')); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(StringParseJsonNumberNotFiniteError);
    expect(thrown.facts.path.segments).toEqual(['a', 'b', '1']);
  });

  it('lifts every in-range magnitude unchanged', async () => {
    expect(fromPlain(JSON.parse('1e308'))).toBe(1e308);
    expect(fromPlain(JSON.parse('-1e308'))).toBe(-1e308);
    expect(fromPlain(JSON.parse('0'))).toBe(0);
  });
});

it('a descriptor writes its keyword field as its name in JSON', async () => {
  expect(await evalQuery('::builtin{:note :draft} | json')).toContain('"note":"draft"');
});

describe('a JSON text reads as its literal reads, the keys in the order it writes them', () => {
  it('keeps a key that reads as an index where it stands among the others', async () => {
    const text = '{"b": 1, "2": 2, "a": 3}';
    expect([...fromJsonText(text).keys()]).toEqual(['b', '2', 'a']);
    expect([...(await evalQuery(text)).keys()]).toEqual(['b', '2', 'a']);
    expect([...(await evalQuery(`${JSON.stringify(text)} | parseJson`)).keys()]).toEqual(['b', '2', 'a']);
  });

  it('reads every kind a document writes, through any whitespace', async () => {
    const text = ' \t{ "v" :\r\n[ 1 , -2.5e1 , "q\\"t\\\\" , true , false , null , { } , [ ] ] }\n';
    const { compareValues } = await import('../../../src/ordering.mjs');
    expect(compareValues(fromJsonText(text), await evalQuery('{:v [1 -25 "q\\"t\\\\" true false null {} []]}')) === 0).toBe(true);
    expect(fromJsonText('5')).toBe(5);
    expect(fromJsonText('"x"')).toBe('x');
  });

  it('stands a key written twice where it first stood, with its last value', () => {
    const read = fromJsonText('{"a": {"x": 1}, "b": 2, "a": {"y": 3}}');
    expect([...read.keys()]).toEqual(['a', 'b']);
    expect([...read.get('a').keys()]).toEqual(['y']);
  });

  it('refuses a number past the doubles at its path', () => {
    let thrown = null;
    try { fromJsonText('{"a": {"b": [1, 1e400]}}'); } catch (caught) { thrown = caught; }
    expect(thrown.address).toBe('string/parseJson/NumberNotFiniteError');
    expect(thrown.facts.path.segments).toEqual(['a', 'b', '1']);
  });

  it('writes a key JavaScript reads as the prototype as any key', async () => {
    expect(await evalQuery('{:"__proto__" 1 :b 2} | json')).toBe('{"__proto__":1,"b":2}');
    expect([...fromJsonText('{"__proto__": 1}').keys()]).toEqual(['__proto__']);
  });
});

it('writes a failure in JSON as the object of its $error, its tag and its facts', async () => {
  const plain = toPlain(await evalQuery('"x" | add 1'));
  expect(Object.keys(plain)).toEqual(['$error']);
  expect(plain.$error.$tag).toBe('number/add/SubjectNotNumberError');
  expect(plain.$error.facts['subject/found']).toBe('x');
});

it('a tag over a set writes its payload as the array of its elements in JSON', () => {
  const taggedSet = makeTagged(makeTag('Keys'), makeSet([2, 1]));
  const plainSet = toPlain(taggedSet);
  expect(plainSet.$tag).toBe('Keys');
  expect(plainSet.payload).toEqual([1, 2]);
});

it('writes a boolean as the boolean of JSON, which parseJson reads back', async () => {
  expect(await evalQuery('true | json')).toBe('true');
  expect(await evalQuery('false | json')).toBe('false');
  expect(await evalQuery('[true false] | map (json | parseJson)')).toEqual([true, false]);
});

it('writes the JSON of a tag name a host hands in a scope as its literal', async () => {
  const scope = new Map(await langRuntime()).set('kindName', makeBinding({ name: makeKeyword('kindName'), value: makeTag('Foo') }));
  const notebook = await createNotebook({ scope });
  const parsed = JSON.parse((await notebook.evalCell('::host | env | json')).result);
  expect(parsed.kindName.payload.value).toBe('::Foo');
});

it('writes a vector under a tag in JSON as its tag beside its payload', async () => {
  const { makeTagged, makeTag } = await import('../../../src/types.mjs');
  const { toPlain } = await import('../../../src/runtime/json.mjs');
  const tagged = makeTagged(makeTag('Box'), [42, 'inner']);
  const plainTagged = toPlain(tagged);
  expect(plainTagged.$tag).toBe('Box');
  expect(plainTagged.payload).toEqual([42, 'inner']);
});
