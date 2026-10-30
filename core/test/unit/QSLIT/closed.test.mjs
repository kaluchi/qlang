import { it, expect } from 'vitest';
import { refusalOf } from '../../helpers/read-text.mjs';

it('writes the template of a literal that computes and reads no subject, each part as it is written and a quote in its group', () => {
  expect(refusalOf('[~(count) (5 | add 1)]').message).toContain('write `get [(~(count)) (5 | add 1)]`');
  expect(refusalOf('[::Box[~(count)] {:q ~(count)} !{:q ~(count)} (5 | add 1)]').message).toContain('write `get [::Box[(~(count))] {:q (~(count))} !{:q (~(count))} (5 | add 1)]`');
  expect(refusalOf('#[~(count) (5 | add 1)]').message).toContain('write `get #[(~(count)) (5 | add 1)]`');
  expect(refusalOf('{:a (5 | add 1)}').message).toContain('write `get {:a (5 | add 1)}`');
  expect(refusalOf('#[(5 | add 1) 1]').message).toContain('write `get #[(5 | add 1) 1]`');
  expect(refusalOf('::Box[(2 | add 1 | mul 2)]').message).toContain('write `get [(2 | add 1 | mul 2)] | tag ::Box`');
  expect(refusalOf('::Foo!{:a (1 | add 1)}').message).toContain('write `get !{:a (1 | add 1)} | tag ::Foo | raise`');
});

it('names the page that tells the shape where a part of the literal reads the subject', () => {
  for (const source of ['[x]', '{:a /a :b (5 | add 1)}', '#[(add 1)]', '[((count) | add 1)]', '[(!| 1)]', '::Box[x]']) {
    expect(refusalOf(source).message, source).toBe('a literal computes nothing: a shape computed from the subject is built by `get`, `::any/get | doc`');
  }
  expect(refusalOf('::Foo!{:a (count)}').message).toBe('an error literal computes nothing: facts computed from the subject are built by `get` and `raise` makes them an error, `::any/raise | doc`');
});

it('refuses a literal whose part computes under a key a later entry writes again, as the text writes it', () => {
  for (const source of ['{:a x :a 1}', '!{:k x :k 1}', '{"a": x, "a": 1}', '::Box{:a x :a 1}']) expect(refusalOf(source)?.message, source).toMatch(/computes nothing/);
  expect(refusalOf('{:a (5 | add 1) :a 1}').message).toContain('write `get {:a (5 | add 1) :a 1}`');
  expect(refusalOf('|~~ a ~({:a (5 | add 1) :a 1}) b ~~|')?.message).toContain('write `get {:a (5 | add 1) :a 1}`');
});
