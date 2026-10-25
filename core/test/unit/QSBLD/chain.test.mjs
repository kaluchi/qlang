import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { printValue } from '../../../src/print-value.mjs';

const answers = async query => printValue(await evalQuery(query));

it('declares construct under a kind its chain built as any other name, the constructor standing in the literal of the kind', async () => {
  const kind = ':Pos |~~ A positive number. ~~| (::kind | accepts |~~ The number. ~~| ::number)';
  expect(await answers(`${kind} | :Pos/construct ~(add 0) | ::Pos#5 | construct`)).toBe('::Pos#5');
  expect(await answers(`${kind} | ::Pos | binding | value | get /1`)).toBe('null');
});

it('a command a function and a kind share, called on another tag, meets the verbs of both nouns, each reached by its address', async () => {
  expect(await answers('::number | holds :E |~~ An e. ~~| ~(true) !| get [~(tag) ~(addresses)]'))
    .toBe('[::call/KindAnswersNoVerbError #[::fn/holds ::kind/holds]]');
});
