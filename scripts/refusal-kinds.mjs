// The kinds the name of a refusal carries [D389]: the words of its last name
// after `Not` name a kind only as the label its subject resides on,
// `number/add/SubjectNotNumberError`, or as the kind a conversion of its
// address reads, `string/toNumber/TextNotNumberError`, a place after `NotIn`,
// `path/KeyNotInMapError`, naming none, so the name moves only with the word,
// and any other refusal of a kind is named by the role of its holder.

import { declarationsOf } from './catalog-kinds.mjs';
import { partOf } from '../core/src/walk.mjs';
import { isCallStep, isConstructStep, isGroupStep } from '../core/src/steps.mjs';
import { isKeyword, isQuote } from '../core/src/types.mjs';

const wordsOf = lastName => lastName.replace(/Error$/, '').split(/(?=[A-Z])/);

// The kind a word names, singular or plural, or null.
const kindOf = (word, nouns) => [word.toLowerCase(), word.toLowerCase().replace(/s$/, '')].find(noun => nouns.has(noun)) ?? null;

// kindsNamedOffTheirAddress(refusals, nouns) → each refusal, `{ address, … }`,
// whose last name names after `Not` a noun of `nouns` in neither place its
// address names it, those nouns its `kinds`.
export function kindsNamedOffTheirAddress(refusals, nouns) {
  return refusals.flatMap(refusal => {
    const segments = refusal.address.split('/');
    const words = wordsOf(segments.at(-1));
    const not = words.indexOf('Not');
    if (not === -1 || words[not + 1] === 'In') return [];
    const label = words.slice(0, not).join('') === 'Subject' ? segments[0].toLowerCase() : null;
    const read = new Set(segments.slice(0, -1).map(segment => segment.toLowerCase()));
    const kinds = words.slice(not + 1).map(word => kindOf(word, nouns))
      .filter(kind => kind !== null && kind !== label && !read.has(`to${kind}`));
    return kinds.length === 0 ? [] : [{ ...refusal, kinds }];
  });
}

// The steps of the chain the body of a declaration builds: those of its group,
// the tag at its head among them, or those of the quote its literal holds
// first [QSBLD#fn], [QSBLD#kind].
function stepsOfChain(body) {
  if (isGroupStep(body)) return body.payload;
  const held = isConstructStep(body) ? body.get('payload') : null;
  return Array.isArray(held) && isQuote(held[0]) ? held[0] : [];
}

// refusalsOfTheCatalog(sources) → the refusals the pages of the sources name,
// each `{ address, file, line }`: what `throws` and `holds` write in the chain
// of a declaration, under its name [D389].
export function refusalsOfTheCatalog(sources) {
  return declarationsOf(sources).flatMap(({ path, value }) => [...stepsOfChain(value.get('body'))]
    .filter(step => isCallStep(step) && ['throws', 'holds'].includes(step.get('name').name) && isKeyword(step.get('modifiers')?.[0]))
    .map(step => ({ address: `${value.get('name').name}/${step.get('modifiers')[0].name}`, file: path, line: partOf(step).span.start.line })));
}

