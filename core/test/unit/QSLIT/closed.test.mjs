import { it, expect } from 'vitest';
import { stepOf, refusalOf } from '../../helpers/read-text.mjs';

it('writes the template of a literal that computes, each part that computes as its quote', () => {
  expect(refusalOf('[~(count) x]').message).toContain('write `get [~(count) ~(x)]`');
  expect(refusalOf('{:a x}').message).toContain('write `get {:a ~(x)}`');
  expect(refusalOf('#[x 1]').message).toContain('write `get #[~(x) 1]`');
  expect(refusalOf('::Box[(add 1 | mul 2)]').message).toContain('write `get ::Box[~(add 1 | mul 2)]`');
  expect(refusalOf('::Foo!{:a (count)}').message).toContain('write `get {:a ~(count)} | tag ::Foo | raise`');
});

it('refuses a literal whose part computes under a key a later entry writes again, as the text writes it', () => {
  for (const source of ['{:a x :a 1}', '!{:k x :k 1}', '{"a": x, "a": 1}', '::Box{:a x :a 1}']) expect(refusalOf(source)?.message, source).toMatch(/computes nothing/);
  expect(refusalOf('{:a x :a 1}').message).toContain('write `get {:a ~(x) :a 1}`');
  expect(refusalOf('|~~ a ~({:a x :a 1}) b ~~|')?.message).toContain('write `get {:a ~(x) :a 1}`');
});
