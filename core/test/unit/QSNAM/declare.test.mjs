import { it, expect } from 'vitest';
import { isBindStep } from '../../../src/steps.mjs';
import { evalQuery } from '../../../src/notebook.mjs';
import { stepOf } from '../../helpers/read-text.mjs';

it('reads `:name it` as a declaration over the word `it`', () => {
  const step = stepOf(':roster it');
  expect(isBindStep(step)).toBe(true);
  expect(step.get('name').name).toBe('roster');
  expect(step.get('body').get('name').name).toBe('it');
});

it('a keyword or a tag name is the body of its declaration', async () => {
  expect(await evalQuery('::bind{:name :s :body :active} | get [~(it)] | tag ::quote | toString')).toBe(':s :active');
  expect(await evalQuery('::bind{:name :s :body ::vec} | get [~(it)] | tag ::quote | toString')).toBe(':s ::vec');
});
