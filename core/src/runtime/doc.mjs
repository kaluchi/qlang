// The primitive of the verb of a doc: its text, `content`, prose
// whatever it writes [D168].

import { bindPrim } from '../primitives.mjs';

bindPrim('doc/content', doc => doc.payload);
