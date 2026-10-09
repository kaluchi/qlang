// `keyword` flips a string and a keyword, a plain function over the
// subject the walk served [D167]: a word of its own on `::string` and on
// `::keyword` [D172].

import { keyword } from '../types.mjs';
import { bindPrim } from '../primitives.mjs';

bindPrim('string/keyword', text => keyword(text));
bindPrim('keyword/keyword', key => key.name);
