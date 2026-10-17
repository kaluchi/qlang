// The terms D357 retired, each held by the lexicon of retired terms as one
// pattern of its one sense [D350], [D357]: the pattern refuses the term in
// prose, in a name of the code and in the name of a case, and leaves the words
// of another sense.

import { describe, it, expect } from 'vitest';
import { RETIRED_WORDS } from '../../../scripts/retired-words.mjs';

const refused = text => RETIRED_WORDS.some(({ pattern }) => pattern.test(text));

describe('the lexicon of retired terms [D357]', () => {
  it('refuses each term D357 retired, in prose, in a name of the code and in the name of a case', () => {
    for (const text of [
      'a-name-of-a-signature-declared-twice-is-refused', 'the signature of a function', 'readSignature', 'readKindSignature',
      'EMPTY_SIGNATURE', 'core/src/runtime/signature.mjs',
      'a-kind-takes-no-recipe-but-the-hosts', 'the-recipe-of-a-kind-command-is-the-check-of-a-host',
      'a-reader-kind-with-the-check-of-its-host-lays-its-tag', 'the check its host hands a kind of the core', 'a kind of no recipe keeps its tag',
      'a-path-of-anchors-reads-an-input-of-a-verb-under-a-label', 'the membership a set answers',
      'reads the member of the subject', 'a member a value lacks names the verbs near', 'a concept is a member of the root noun',
      'callMemberOn', 'isMemberValue', 'nearestMembers', 'memberRecordOf', 'memberRefusalOf', 'recordAlongPath'
    ]) expect(refused(text), text).toBe(true);
  });

  it('leaves the words of another sense, the help of the language server and the series of the benchmark among them', () => {
    for (const text of [
      'signature help', 'signatureHelpAtOffset', 'SignatureInformation', 'activeSignature', 'deliberately wide signatures',
      'a member of a series', 'the members of each series past its two latest', 'the recipe of a verb',
      'the check of the conventions', 'the check of the chapters', 'answers a bare out-of-range magnitude with an empty path'
    ]) expect(refused(text), text).toBe(false);
  });
});
