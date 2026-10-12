// The primitives of the verbs of a doc: its text, `content`, which writes
// its quotes as text among its prose, its parts, `segments` [D19], and its
// links and snippets, the quotes in the role of a link or a snippet
// [D108], [D122], [D175].

import { bindPrim } from '../primitives.mjs';
import { docText } from '../quote.mjs';
import { isTag, isValueClass } from '../types.mjs';

// The names of the tags a segment stands beneath, from the outside in, a
// role's and a host's among them [D108], and the quote or the prose
// beneath them.
function beneathTags(segment) {
  const tagNames = [];
  let beneath = segment;
  for (; isValueClass(beneath, 'taggedInstance'); beneath = beneath.payload) tagNames.push(beneath.tag.name);
  return { tagNames, beneath };
}

const inRole = roleName => segment => beneathTags(segment).tagNames.includes(roleName);

// linksOf(doc) → the segments of a page in the role of a link.
export const linksOf = doc => Object.freeze(doc.filter(inRole('link')));

// linkedAddressesOf(doc) → the address each link of a page opens with,
// `::link~(::any/sumOf | doc)` opening with `any/sumOf`; a link that
// opens with no tag name names none [D242].
export function linkedAddressesOf(doc) {
  return linksOf(doc).map(link => beneathTags(link).beneath[0]).filter(isTag).map(tag => tag.name);
}

bindPrim('doc/content', docText);
bindPrim('doc/segments', doc => Object.freeze([...doc]));
bindPrim('doc/links', linksOf);
bindPrim('doc/snippets', doc => Object.freeze(doc.filter(inRole('snippet'))));
