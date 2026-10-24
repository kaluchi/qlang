// [QSSLF#doc]

import { registerPrimitive } from '../primitives.mjs';
import { docText } from '../print-value.mjs';
import { linksOf, snippetsOf } from '../doc-parts.mjs';

registerPrimitive('doc/content', docText);
registerPrimitive('doc/segments', doc => Object.freeze([...doc]));
registerPrimitive('doc/links', linksOf);
registerPrimitive('doc/snippets', snippetsOf);
