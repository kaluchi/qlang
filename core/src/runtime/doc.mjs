// The primitives of the verbs of a doc: its text, `content`, which writes
// its quotes as text among its prose, its parts, `segments` [D95], its
// laws, the quotes with no tag, and its links and snippets, the quotes in
// the role of a link or a snippet [D108], [D122].

import { bindPrim } from '../primitives.mjs';
import { isQuote, isValueClass } from '../types.mjs';
import { docText } from '../quote.mjs';

bindPrim('docContent', docText);
bindPrim('docSegments', doc => Object.freeze([...doc]));
bindPrim('docLaws', doc => Object.freeze(doc.filter(isQuote)));
bindPrim('docLinks', doc => Object.freeze(doc.filter(segment => holdsRole(segment, 'link'))));
bindPrim('docSnippets', doc => Object.freeze(doc.filter(segment => holdsRole(segment, 'snippet'))));

// A segment in a role: a quote under a stack of tags that holds the tag
// of the role, `::link` or `::snippet`, a host's tag over it among them.
function holdsRole(segment, roleName) {
  for (let beneath = segment; isValueClass(beneath, 'taggedInstance'); beneath = beneath.payload) {
    if (beneath.tag.name === roleName) return true;
  }
  return false;
}
