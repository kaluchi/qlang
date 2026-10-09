// The primitives of the verbs of a doc: its text, `content`, which writes
// its quotes as text among its prose, its parts, `segments` [D95], its
// laws, the quotes with no tag, and its links and snippets, the quotes in
// the role of a link or a snippet [D108], [D122].

import { bindPrim } from '../primitives.mjs';
import { isQuote } from '../types.mjs';
import { docText } from '../quote.mjs';
import { holdsRole } from './nouns.mjs';

bindPrim('doc/content', docText);
bindPrim('doc/segments', doc => Object.freeze([...doc]));
bindPrim('doc/laws', doc => Object.freeze(doc.filter(isQuote)));
bindPrim('doc/links', doc => Object.freeze(doc.filter(segment => holdsRole(segment, 'link'))));
bindPrim('doc/snippets', doc => Object.freeze(doc.filter(segment => holdsRole(segment, 'snippet'))));
