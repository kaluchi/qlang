// `env` reads the state of its call [D79] and answers the names of the
// scope, the nouns of the root among them [D61], [D153].

import { bindStateReader } from '../primitives.mjs';
import { scopeNamesOf } from './nouns.mjs';

bindStateReader('env', (subject, state) => scopeNamesOf(state.env));
