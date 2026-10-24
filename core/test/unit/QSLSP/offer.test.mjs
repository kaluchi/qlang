import { it, expect } from 'vitest';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';
import { answerKindsOf, nodeOf, verbsReaching } from '../../../src/nouns.mjs';
import { servesTheSubject } from '../../../src/dispatch.mjs';
import { createNotebook } from '../../../src/notebook.mjs';
import { parseSource } from '../../../src/parse.mjs';
import { holdsALiteral } from '../../../src/steps.mjs';
import { makeTag } from '../../../src/types.mjs';

it('reads the kinds of the answer of a name from the kinds its returns names, the subject\'s own where that is the verb\'s own label', async () => {
  const scope = await langRuntime();
  expect(answerKindsOf(scope, nodeOf(scope, 'vec/filter'), ['set'])).toEqual(['set']);
  expect(answerKindsOf(scope, nodeOf(scope, 'vec/count'), ['vec'])).toEqual(['number']);
  expect(answerKindsOf(scope, nodeOf(scope, 'any/coalesce'), ['vec'])).toBeNull();
});

it('reads the kinds of the answer of a call as the evaluator lays it: the walk of the subject through the verb\'s own label where the walk reaches it, the noun a tag name names reached by no label and left out, and the kinds its returns names elsewhere', async () => {
  const notebook = await createNotebook();
  await notebook.evalCell(':Box |~~ A box. ~~| | :Box/f ~(1)');
  const { scope } = notebook;
  const kindsAfter = (address, kinds) => answerKindsOf(scope, nodeOf(scope, address), kinds);
  expect([kindsAfter('tag/toTag', ['tag', 'vec']), kindsAfter('kind/wraps', ['tag', 'kind']), kindsAfter('vec/sort', ['Box', 'tagged', 'vec'])])
    .toEqual([['tag'], ['kind'], ['Box', 'tagged', 'vec']]);
  expect(verbsReaching(scope, kindsAfter('vec/sort', ['Box', 'tagged', 'vec'])).get('f').address.name).toBe('Box/f');
});

it('keeps of the walk the kinds up to its label and the kind `::tagged` of the value the label reached, none of the kinds beneath it, which the answer may change, and beside them the other kinds its returns names', async () => {
  const notebook = await createNotebook();
  await notebook.evalCell(':Box |~~ A box. ~~| | :Box/g (::fn | returns |~~ A box. ~~| ::Box | impl ~(it)) | :vec/h (::fn | returns |~~ A count or a vector. ~~| #[::vec ::number] | impl ~(count))');
  const { scope } = notebook;
  const kindsAfter = (address, kinds) => answerKindsOf(scope, nodeOf(scope, address), kinds);
  expect([kindsAfter('tagged/within', ['Box', 'tagged', 'vec']), kindsAfter('Box/g', ['Box', 'tagged', 'vec']), kindsAfter('vec/h', ['vec'])])
    .toEqual([['Box', 'tagged'], ['Box', 'tagged'], ['vec', 'number']]);
  const answers = await Promise.all(['::Box[1 2] | within ~(get /0) | type', '::Box[1 2] | within ~(get /0) | payload | type', '[1 2] | h | type'].map(query => notebook.evalCell(query)));
  expect(answers.map(cell => cell.result.name)).toEqual(['Box', 'number', 'number']);
});

it('reads the kinds of an answer its returns names as a set', async () => {
  const notebook = await createNotebook();
  await notebook.evalCell(':Box |~~ A box. ~~| | :Box/f (::fn | returns |~~ The value. ~~| #[::number ::string] | impl ~(eq 1))');
  expect(answerKindsOf(notebook.scope, nodeOf(notebook.scope, 'Box/f'), ['Box'])).toEqual(['number', 'string']);
});

it('reads a literal step, a tagged literal among them, apart from a step that computes or declares', () => {
  expect(['[1 2]', '::Box{:a 1}', '1', '~(a)', '(add 1)', ':x 1', 'count'].map(source => holdsALiteral(parseSource(source)[0]))).toEqual([true, true, true, true, false, false, false]);
});

it('holds whether a verb serves a subject as its call does, a tag name served by a verb of its noun whose `on` names `::tag` alone', async () => {
  const notebook = await createNotebook();
  await notebook.evalCell(':Desk |~~ A help desk. ~~| | :Desk/hours (::fn | on |~~ The desk. ~~| ::tag | impl ~("9 to 5")) | :Desk/size ~(count)');
  const serves = (address, subject) => servesTheSubject(nodeOf(notebook.scope, address), subject);
  const [desk, vec] = [makeTag('Desk'), makeTag('vec')];
  expect([serves('vec/count', [1]), serves('vec/count', vec), serves('tag/toTag', vec), serves('Desk/hours', desk), serves('Desk/hours', vec), serves('Desk/size', desk)])
    .toEqual([true, false, true, true, false, false]);
});
