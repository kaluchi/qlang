// `env` reads the state of its call [D79] and answers what the reader
// declared, the cells of a session and the steps before it, by name
// [D61], [D160]; `kinds` answers the kinds the scope reads, the root's
// and the reader's, each by its tag.

import { bindStateReader } from '../primitives.mjs';
import { makeSet, makeTagKeyword } from '../types.mjs';
import { kindNamesOf, readerNamesOf } from './nouns.mjs';

bindStateReader('any/env', (subject, state) => readerNamesOf(state.env));
bindStateReader('any/kinds', (subject, state) => makeSet(kindNamesOf(state.env).map(makeTagKeyword)));
