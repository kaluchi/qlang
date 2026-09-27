// The primitive of `env`, which reads the state of its call [D79] and
// answers the names the query, the session and a module's `use` wrote as
// a map of the records of their bindings [D61], [D63].

import { bindStateReader } from '../primitives.mjs';
import { scopeBindingsOf } from './nouns.mjs';

bindStateReader('env', (subject, state) => scopeBindingsOf(state.env));
