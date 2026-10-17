// The retired terms of the chain, of the slot of a kind and of the node an
// axis reads, each held by the lexicon of retired terms as one pattern of
// its one sense [QSWRK#documents], which refuses the term where it is
// written, in prose, a name of the code or the name of a case, and leaves
// the words of another sense.

import { describe, it, expect } from 'vitest';
import { RETIRED_WORDS } from '../../../scripts/retired-words.mjs';

const refused = text => RETIRED_WORDS.some(({ pattern }) => pattern.test(text));

describe('the lexicon of retired terms [QSWRK#documents]', () => {
  it('refuses each retired term of the chain, of the slot of a kind and of the node where it is written', () => {
    for (const text of [
      'a-name-of-a-signature-declared-twice-is-refused', 'the signature of a function', 'readSignature', 'readKindSignature',
      'EMPTY_SIGNATURE', 'core/src/runtime/signature.mjs',
      'a-kind-takes-no-recipe-but-the-hosts', 'the-recipe-of-a-kind-command-is-the-check-of-a-host',
      'a-reader-kind-with-the-check-of-its-host-lays-its-tag', 'the check its host hands a kind of the core', 'a kind of no recipe keeps its tag',
      'a-path-of-anchors-reads-an-input-of-a-verb-under-a-label', 'the membership a set answers',
      'reads the member of the subject', 'a member a value lacks names the verbs near', 'a concept is a member of the root noun',
      'a-member-a-value-lacks-names-the-verbs-near', 'a-member-of-a-noun-stays-out-of-the-scope', 'the-chapters-are-members-of-the-topic-of-the-language',
      'a-kind-of-no-recipe-keeps-its-tag-after-sort', 'the check of a kind',
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
