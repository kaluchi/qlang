// `env` reads the state of its call [QSDSP#residence] and answers what the
// reader declared, the cells of a session and the steps before it, by name
// [QSSLF#axis], [QSNAM#binding]; `kinds` answers the kinds the scope reads,
// the root's and the reader's, each by its tag.

import { registerStateReader } from '../primitives.mjs';
import { makeTag } from '../types.mjs';
import { makeSet } from '../ordering.mjs';
import { kindNamesOf, readerNamesOf } from '../nouns.mjs';

registerStateReader('any/env', (subject, state) => readerNamesOf(state.env));
registerStateReader('any/kinds', (subject, state) => makeSet(kindNamesOf(state.env).map(makeTag)));
