// `keyword` flips a string and a keyword, a plain function over the
// subject the walk served [D167]: it resides on `::string` and on
// `::keyword`, under its contract on `::any`.

import { isString, keyword } from '../types.mjs';
import { bindPrim } from '../primitives.mjs';

bindPrim(['string/keyword', 'keyword/keyword'], subject => (isString(subject) ? keyword(subject) : subject.name));
