// `keyword` flips a string and a keyword, a plain function over the
// subject the head of its verb checked [D72]: it resides on `::string`
// and on `::keyword`, under its contract on `::qlang/any`.

import { isString, keyword } from '../types.mjs';
import { bindPrim } from '../primitives.mjs';

bindPrim('keyword', subject => (isString(subject) ? keyword(subject) : subject.name));
