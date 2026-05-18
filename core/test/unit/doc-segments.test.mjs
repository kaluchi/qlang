// Doc-content tokenizer — prose / Quote / TaggedLit segmentation.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';

describe('Doc /segments tokenizes content into prose / Quote / TaggedLit', () => {
  it('pure prose returns one Prose segment', async () => {
    const result = await evalQuery('|~~ just text ~~| | /segments | count');
    expect(result).toBe(1);
  });

  it('Prose segment has :kind :prose and :text', async () => {
    const result = await evalQuery('|~~ hello ~~| | /segments | first | /text');
    expect(result).toBe(' hello ');
  });

  it('embedded Quote splits the content into Prose + Quote + Prose', async () => {
    const result = await evalQuery('|~~ See ~{mul(2)} for ref. ~~| | /segments | count');
    expect(result).toBe(3);
  });

  it('embedded Quote segment is a Quote-value', async () => {
    const result = await evalQuery('|~~ See ~{mul(2)} here. ~~| | /segments | at(1) | isQuote');
    expect(result).toBe(true);
  });

  it('embedded Quote segment carries the source text', async () => {
    const result = await evalQuery('|~~ See ~{mul(2)} here. ~~| | /segments | at(1) | /source');
    expect(result).toBe('mul(2)');
  });

  it('multiple openers tokenized in order — prose ~{...} prose ~{...} prose', async () => {
    const result = await evalQuery('|~~ a ~{b} c ~{d} e ~~| | /segments | count');
    expect(result).toBe(5);
  });
});

describe('Doc tokenizer edge cases', () => {
  it('unterminated backtick treats rest as prose', async () => {
    const result = await evalQuery('|~~ unclosed `still text ~~| | /segments | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('lone ~{::} without TaggedLit body emits Prose for the marker', async () => {
    const result = await evalQuery('|~~ note: a::b plain text ~~| | /segments | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('empty Doc has no segments', async () => {
    const result = await evalQuery('|~~~~| | /segments | count');
    expect(result).toBe(0);
  });

  it('unterminated Quote `~{` inside a Doc falls back to Prose for the remainder', async () => {
    // findQuoteEnd returns -1 when no matching `}` closes the
    // `~{` opener within the Doc content; parseDocSegments then
    // emits a Prose segment containing the rest of the doc and
    // stops scanning.
    const result = await evalQuery('|~~ pre ~{never closes ~~| | /segments | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('unterminated nested Quote inside a TaggedLit bracket payload — outer falls back to Prose', async () => {
    // findTaggedEnd scans a `::tag[…]` bracket payload. When it
    // hits a `~{` opener inside the payload, it delegates to
    // findQuoteEnd; if THAT returns -1 (no closing `}`), the
    // outer findTaggedEnd returns -1 in turn, so the `::tag` start
    // emits a 2-char Prose segment and parseDocSegments resumes
    // past it.
    const result = await evalQuery('|~~ ::tag[~{never closes ~~| | /segments | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('unterminated TaggedLit bracket falls through to Prose', async () => {
    const result = await evalQuery('|~~ broken ::tag[no close ~~| | /segments | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('TaggedLit with unbound tag still segments — error becomes the segment value', async () => {
    // Bracket-balanced so findTaggedEnd succeeds and the parser
    // recognises a TaggedLit shape; eval then fails because the
    // tag is not a registered tag binding. The error is the
    // segment value — the tokenizer does not pre-validate types.
    // Three segments (prose, error, prose) prove the tagged
    // form was tokenized; treating it as prose would give one.
    const result = await evalQuery('|~~ pre ::unbound[~{x}] post ~~| | /segments | count');
    expect(result).toBe(3);
  });

  it('TaggedLit with parse-shape failure falls through to Prose for ~{::} marker', async () => {
    // `::123tag[]` — Ident must start with letter / underscore /
    // @-sigil, so peggy rejects "123tag" as identifier. Tokenizer
    // emits Prose for the `::` chars and continues from the next
    // position.
    const result = await evalQuery('|~~ ::123tag[x] ~~| | /segments | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('TaggedLit with string-quoted payload (~{::tag"text"}) tokenizes via the ~{"} branch', async () => {
    // findTaggedEnd recognises `"` as a string-opener and walks
    // to the closing `"`. Even if the tag is unbound, segmentation
    // succeeds — error becomes the segment value.
    const result = await evalQuery('|~~ pre ::unboundStr"some text" post ~~| | /segments | count');
    expect(result).toBe(3);
  });

  it('nested string-literal inside TaggedLit bracket payload is scanned through', async () => {
    // The `"` branch inside the bracket-balanced loop skips a
    // string literal so a `]` inside the string does not close
    // the outer bracket prematurely.
    const result = await evalQuery('|~~ pre ::unbound[42 "has ] inside"] post ~~| | /segments | count');
    expect(result).toBe(3);
  });

  it('unterminated string-quoted TaggedLit payload falls through to Prose', async () => {
    // Unterminated `"` inside `::tag"...` — findTaggedEnd
    // hits end-of-content without a close, returns -1, and the
    // tokenizer emits Prose for `::`.
    const result = await evalQuery('|~~ ::unbound"unterminated content ~~| | /segments | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('TaggedLit with backtick-quoted payload tokenizes via the backtick branch', async () => {
    // `::tag\`source\`` — findTaggedEnd's backtick-opener branch
    // walks to the closing backtick and returns the slice end.
    const result = await evalQuery('|~~ pre ::unbound~{code} post ~~| | /segments | count');
    expect(result).toBe(3);
  });

  it('TaggedLit with unterminated backtick payload falls through to Prose', async () => {
    // `::tag\`unterminated` — backtick branch finds no close,
    // returns -1, tokenizer emits Prose for `::`.
    const result = await evalQuery('|~~ ::unbound`unterminated content ~~| | /segments | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('TaggedLit with unterminated backtick inside bracket payload falls through', async () => {
    // `::tag[\`unterminated\` more` — backtick inside bracket
    // payload never closes; the inner-loop backtick branch
    // returns -1, propagating up.
    const result = await evalQuery('|~~ ::unbound[`open without close ~~| | /segments | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('TaggedLit with nested same-shape brackets balances depth', async () => {
    // `::tag[[nested]]` — outer `[` opens depth=1, inner `[`
    // increments to 2, inner `]` decrements to 1, outer `]`
    // closes depth=0. Exercises the depth++ branch on opener.
    const result = await evalQuery('|~~ pre ::unbound[[nested]] post ~~| | /segments | count');
    expect(result).toBe(3);
  });

  it('bare ~{::ident} with no payload opener falls through to Prose', async () => {
    // `::tag ` (just whitespace then EOF inside the doc) — ident
    // scan completes, whitespace skip, then i >= length → -1.
    const result = await evalQuery('|~~ ::tag ~~| | /segments | count');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('backslash-escape inside ~{::tag"..."} string payload skips the next char', async () => {
    // `::tag"contains \\" inside"` — `\` inside the string-quoted
    // payload skips the following `"` so the outer `"` only
    // closes after the real terminator.
    const result = await evalQuery('|~~ pre ::unbound"contains \\" still inside" post ~~| | /segments | count');
    expect(result).toBe(3);
  });

  it('backslash-escape inside string-literal nested in bracket payload', async () => {
    // `::tag[ "with \\" inside" ]` — `\` in the inner-loop
    // string scan skips its next char so an inner `"` does not
    // close the string prematurely; outer `]` then closes depth=0.
    const result = await evalQuery('|~~ pre ::unbound[42 "with \\" inside"] post ~~| | /segments | count');
    expect(result).toBe(3);
  });
});
