// The primitives of the verbs of a doc: its text, `content`, which writes its
// quotes as text among its prose, its parts, `segments`, and its links and
// snippets, the quotes in the role of a link or a snippet [QSSLF#doc].

import { registerPrimitive } from '../primitives.mjs';
import { docText } from '../print-value.mjs';
import { linksOf, snippetsOf } from '../doc-parts.mjs';

registerPrimitive('doc/content', docText);
registerPrimitive('doc/segments', doc => Object.freeze([...doc]));
registerPrimitive('doc/links', linksOf);
registerPrimitive('doc/snippets', snippetsOf);
