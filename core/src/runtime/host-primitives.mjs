// [QSDSP#residence], [QSNAM#binding], [QSNAM#address]

import { registerStateReader } from '../primitives.mjs';
import { makeTag } from '../types.mjs';
import { makeSet } from '../ordering.mjs';
import { kindNamesOf, readerNamesOf } from '../nouns.mjs';

registerStateReader('host/env', (subject, state) => readerNamesOf(state.scope));
registerStateReader('host/kinds', (subject, state) => makeSet(kindNamesOf(state.scope).map(makeTag)));
