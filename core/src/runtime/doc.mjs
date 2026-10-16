// The primitives of the verbs of a doc: its text, `content`, which writes its
// quotes as text among its prose, its parts, `segments`, and its links and
// snippets, the quotes in the role of a link or a snippet [QSSLF#doc].

import { bindPrim } from '../primitives.mjs';
import { docText } from '../quote.mjs';
import { beneathTags, isTag, isValueClass } from '../types.mjs';

// The names of the tags over a segment, its role's among them [QSSLF#doc].
function tagNamesOver(segment) {
  const tagNames = [];
  for (let over = segment; isValueClass(over, 'underTag'); over = over.payload) tagNames.push(over.tag.name);
  return tagNames;
}

const inRole = roleName => segment => tagNamesOver(segment).includes(roleName);

// linksOf(doc) → the segments of a page in the role of a link.
export const linksOf = doc => Object.freeze(doc.filter(inRole('link')));

// linkedAddressesOf(doc) → the address each link of a page opens with,
// `::link~(::any/sumOf | doc)` opening with `any/sumOf`; a link that
// opens with no tag name names none [QSSLF#near].
export function linkedAddressesOf(doc) {
  return linksOf(doc).map(link => beneathTags(link)[0]).filter(isTag).map(tag => tag.name);
}

bindPrim('doc/content', docText);
bindPrim('doc/segments', doc => Object.freeze([...doc]));
bindPrim('doc/links', linksOf);
bindPrim('doc/snippets', doc => Object.freeze(doc.filter(inRole('snippet'))));
