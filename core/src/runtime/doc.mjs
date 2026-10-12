// The primitives of the verbs of a doc: its text, `content`, which writes
// its quotes as text among its prose, its parts, `segments` [D19], and its
// links and snippets, the quotes in the role of a link or a snippet
// [D108], [D122], [D175].

import { bindPrim } from '../primitives.mjs';
import { docText } from '../quote.mjs';
import { isValueClass } from '../types.mjs';

bindPrim('doc/content', docText);
bindPrim('doc/segments', doc => Object.freeze([...doc]));
bindPrim('doc/links', doc => Object.freeze(doc.filter(segment => holdsRole(segment, 'link'))));
bindPrim('doc/snippets', doc => Object.freeze(doc.filter(segment => holdsRole(segment, 'snippet'))));

// Whether a segment holds the tag of a role, `link` or `snippet`, under
// the stack of tags over it, a host's among them [D108].
function holdsRole(segment, roleName) {
  for (let beneath = segment; isValueClass(beneath, 'taggedInstance'); beneath = beneath.payload) {
    if (beneath.tag.name === roleName) return true;
  }
  return false;
}
