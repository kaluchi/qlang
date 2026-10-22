// [QSDSP#residence], [QSSLF#axis], [QSNAM#binding]

import { registerStateReader } from '../primitives.mjs';
import { makeTag } from '../types.mjs';
import { makeSet } from '../ordering.mjs';
import { kindNamesOf, readerNamesOf } from '../nouns.mjs';

registerStateReader('any/env', (subject, state) => readerNamesOf(state.scope));
registerStateReader('any/kinds', (subject, state) => makeSet(kindNamesOf(state.scope).map(makeTag)));
