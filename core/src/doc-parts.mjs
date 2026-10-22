// [QSSLF#doc]

import { beneathTags, isTag, isValueClass } from './types.mjs';

function tagNamesOver(segment) {
  const tagNames = [];
  for (let over = segment; isValueClass(over, 'underTag'); over = over.payload) tagNames.push(over.tag.name);
  return tagNames;
}

const inRole = roleName => segment => tagNamesOver(segment).includes(roleName);

export const linksOf = doc => Object.freeze(doc.filter(inRole('link')));
export const snippetsOf = doc => Object.freeze(doc.filter(inRole('snippet')));

// [QSSLF#near]
export function linkedAddressesOf(doc) {
  return linksOf(doc).map(link => beneathTags(link)[0]).filter(isTag).map(tag => tag.name);
}
