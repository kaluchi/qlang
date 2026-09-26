// `env` reads the scope of its call: it answers the bindings the scope
// holds as a map, the names the query, the session and a module's `use`
// wrote [D61], each as the record of its binding [D63], so introspective
// queries (`env | keys`, `env | /x | /value`) compose through the
// verbs of maps. The verb resides on `::qlang/any`, and its primitive
// reads the state of the call [D79].

import { bindStateReader } from '../primitives.mjs';
import { scopeBindingsOf } from './nouns.mjs';

bindStateReader('env', (subject, state) => scopeBindingsOf(state.env));
