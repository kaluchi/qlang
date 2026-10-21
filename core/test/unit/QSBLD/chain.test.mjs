import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { printValue } from '../../../src/print-value.mjs';

const answers = async query => printValue(await evalQuery(query));

describe('a declaration under a label that the chain of its kind holds alone', () => {
  it('refuses a constructor declared by a name under a kind its chain built', async () => {
    const kind = ':Pos |~~ A positive number. ~~| (::kind | wraps |~~ The number. ~~| ::number)';
    expect(await answers(`${kind} | :Pos/construct ~(add 0) !| type`)).toBe('::bind/WrittenOutsideItsChainError');
  });
});

describe('a command a function and a kind share, called on another tag', () => {
  it('meets the verbs of both nouns, each reached by its address', async () => {
    expect(await answers('::number | holds :E |~~ An e. ~~| ~(true) !| get [~(type) /addresses]'))
      .toBe('[::call/KindAnswersNoVerbError #[::fn/holds ::kind/holds]]');
  });
});
