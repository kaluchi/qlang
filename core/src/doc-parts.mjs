// The parts of a doc in a role [QSSLF#doc]: its segments under the tag of a
// link or of a snippet, and the address each link opens with.

import { beneathTags, isTag, isValueClass } from './types.mjs';

// The names of the tags over a segment, its role's among them [QSSLF#doc].
function tagNamesOver(segment) {
  const tagNames = [];
  for (let over = segment; isValueClass(over, 'underTag'); over = over.payload) tagNames.push(over.tag.name);
  return tagNames;
}

const inRole = roleName => segment => tagNamesOver(segment).includes(roleName);

export const linksOf = doc => Object.freeze(doc.filter(inRole('link')));
export const snippetsOf = doc => Object.freeze(doc.filter(inRole('snippet')));

// linkedAddressesOf(doc) → the address each link of a page opens with,
// `::link~(::any/sumOf | doc)` opening with `any/sumOf`; a link that
// opens with no tag name names none [QSSLF#near].
export function linkedAddressesOf(doc) {
  return linksOf(doc).map(link => beneathTags(link)[0]).filter(isTag).map(tag => tag.name);
}
