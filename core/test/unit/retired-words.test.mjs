// The retired terms of the chain, of the slot of a kind, of the node an
// axis reads and of the trace a failure leaves, each held by the lexicon of
// retired terms as one pattern of its one sense [QSWRK#documents], [D359],
// which refuses the term where it is written, in prose, a name of the code
// or the name of a case, and leaves the words of another sense.

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

  it('refuses each retired term of the trace, of the step that failed and of the evaluation depth where it is written [D359]', () => {
    for (const text of [
      'the trail of a failure', 'Trails are read by trail', '`:trail` among the facts', '`::trail[]`', '`!| get /trail/1/0`',
      'core/src/eval-trail.mjs', 'a-raised-error-holds-its-trail', 'quote-with-leading-combinator-trail-style',
      'makeTrail', 'isTrail', 'withTrail', 'resumingItsTrail', 'TRAIL_TAG', 'RESUMING_THEIR_TRAIL',
      '::error/TrailNotFramesError', 'ErrorTrailNotFramesError',
      '::frame/step', '!| trail | map ~step', 'trace | first | step', 'trace-of-a-frame-read-by-map-~step',
      'the step that broke', 'the steps from the one that broke', 'the element its code broke on', 'its predicate broke at',
      'the-frame-of-map-names-the-index-of-the-element-its-code-broke-on', 'the-frame-of-sort-names-the-index-its-key-broke-at',
      'the reducer that broke', 'its reducer broke on the element', 'the key that broke', 'brokeAt',
      'frameBelow', 'the budget of frames', 'one frame below the call', 'a-modifier-of-an-atom-meets-the-budget-a-frame-below-its-call',
      'the frames of a runaway meet a budget', 'one more nested frame of evaluation', 'the frames one evaluation may nest',
      'the evaluation depth budget', 'a location set by a deeper frame', 'the deepest frame nestState admits', 'the refused frame',
      'a-quote-written-as-a-modifier-runs-no-frame',
      '`subject`, `step`, `skipped` and `place`, verbs of `::frame`, read a frame', '`::frame["x" ~(add 1 | mul 2)] | step` answering `~(add 1)`',
      '`step` reads a frame, which the trace of a failure holds', 'the element the code of `map` broke on',
      'The frame the budget refused.', 'itself without end, is refused on the frame past it', 'the frame past the budget refuses',
      'depth of the frames nested under the query', 'meet the budget of frames one below',
      'rootState opens depth 0; withPipeValue and withEnv stay on the frame', 'nestState descends one frame with the inner pair',
      'nestState admits the frame at EVAL_DEPTH_LIMIT', 'Each call runs a frame: an input',
      '`add 1`, which broke on `"x"`', '`map`, which broke where its code ran', '`mul 2`, which broke on',
      'the path of the part, where it broke, null where it ran it on no part', 'that broke, the first broken and the rest left unrun',
      'an input read from its place meets the budget', 'a read with no state meets the budget by it alone.',
      'leaves the budget intact for recursion that terminates', 'the frames of the evaluator', 'the budget of the evaluator'
    ]) expect(refused(text), text).toBe(true);
  });

  it('refuses a frame for the scope of a source where it is written [D359]', () => {
    for (const text of ['no frame of its source before them', 'each source a cell run in a frame over the root', 'the frames of the sources']) {
      expect(refused(text), text).toBe(true);
    }
  });

  it('leaves the words of another sense, the help of the language server and the series of the benchmark among them', () => {
    for (const text of [
      'signature help', 'signatureHelpAtOffset', 'SignatureInformation', 'activeSignature', 'deliberately wide signatures',
      'a member of a series', 'the members of each series past its two latest', 'the recipe of a verb',
      'the check of the conventions', 'the check of the chapters', 'answers a bare out-of-range magnitude with an empty path'
    ]) expect(refused(text), text).toBe(false);
  });

  it('leaves the words of another sense beside the trace: a frame of a trace, the budget of a print, and a case, a law, a tag and a stream that broke [D359]', () => {
    for (const text of [
      'a frame of the trace holds the subject its step met', 'the frame of `map`', 'a frame a line', 'the frame of its step',
      'trim_trailing_whitespace', 'a trailing newline', 'trailing-separator-leaves-empty', 'Trailing',
      '[QSERR#trail]', 'the step that failed', 'failedAt', 'a reader\'s own verb `:number/step`', 'reduce 0 ~(step)', '!| step',
      'tell a repair from a case that broke', 'a broken case', 'the tag that broke it its `:actualValue`',
      'stream broke', 'a law broke', 'a quote left broken in a page', 'breaks an invariant',
      'a law broke at the edges of its literals', 'the stream broke on a bad byte', 'whether a repair moved it or the case broke',
      'the stream which broke on a bad byte', 'a law which broke at the edges of its literals',
      'the case `a-doc-is-no-trace` broke on the tree', 'the stream, where it broke, names its byte',
      'depthBelow', 'one deeper in the evaluation depth', 'a stack frame reads', 'a synchronized frame',
      'the budget of a print', 'elide within a budget', 'an answer whose print fits the budget stays whole',
      'an answer whose print meets the budget stays whole', 'the print leaves the budget intact',
      'the frame of a trace', 'the scope of a source', 'the subject of every frame past the first',
      'the frames nested under the frame of `map`', 'the frame below it in the print',
      'the frame of `map` stands a frame below the frame of `count` in the print', 'the frame of the raise lies one frame below the catch',
      'the frames one below another print a frame a line', 'the deepest frame of a trace is its first',
      'the steps a failure skips stay on the frame of the step that failed', 'the key that broke the order', 'the code that broke it'
    ]) expect(refused(text), text).toBe(false);
  });
});
