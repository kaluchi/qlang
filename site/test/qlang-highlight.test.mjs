// The site paints a source by the core's `tokenize`, each token a span whose
// class is its kind [D371].
// The rules it holds: [QSWRK#tooling], [D371].

import { describe, it, expect, beforeAll } from 'vitest';
import { langRuntime, verbNames } from '@kaluchi/qlang-core';
import { highlightQlang } from '../src/lib/qlang-highlight.js';

let rootVerbNames;
beforeAll(async () => {
  const scope = await langRuntime();
  rootVerbNames = verbNames(scope);
});

const hl = src => highlightQlang(src, rootVerbNames);

// ── Literals ───────────────────────────────────────────────────

describe('a literal', () => {
  it('is a span of the kind of its value', () => {
    expect(hl('"hello"')).toBe('<span class="string">"hello"</span>');
    expect(hl('3.14')).toBe('<span class="number">3.14</span>');
    expect(hl('true')).toBe('<span class="boolean">true</span>');
    expect(hl('null')).toBe('<span class="null">null</span>');
    expect(hl(':foo')).toBe('<span class="keyword">:foo</span>');
    expect(hl('/a/b')).toBe('<span class="path">/a/b</span>');
    expect(hl('::Box')).toBe('<span class="tag">::Box</span>');
  });

  it('escapes the HTML its text holds', () => {
    expect(hl('"a<b"')).toBe('<span class="string">"a&lt;b"</span>');
  });
});

// ── Names ──────────────────────────────────────────────────────

describe('a name', () => {
  it('is a verb where it calls a word of the root', () => {
    expect(hl('count')).toBe('<span class="verb">count</span>');
  });

  it('is a declaration where a declaration writes it', () => {
    expect(hl(':x 1')).toContain('<span class="declaration">:x</span>');
  });

  it('is a name where it calls a reader\'s, and wherever no names of the root\'s words are handed', () => {
    const out = hl(':double mul 2 | 10 | double');
    expect(out).toContain('<span class="name">double</span>');
    expect(highlightQlang('count', null)).toBe('<span class="name">count</span>');
  });
});

// ── The rest of the source ─────────────────────────────────────

describe('the rest of the source', () => {
  it('paints the pipe as punctuation and the fail track as fail', () => {
    expect(hl('1 | add 1')).toContain('<span class="punctuation">|</span>');
    expect(hl('1 !| /k')).toContain('<span class="fail">!|</span>');
  });

  it('paints the brackets of a group, a vector, a set, a map and an error literal each by its kind', () => {
    expect(hl('take (count | sub 1)')).toContain('<span class="group">(</span>');
    expect(hl('[1 2]')).toBe('<span class="vec">[</span><span class="number">1</span><span class="whitespace"> </span><span class="number">2</span><span class="vec">]</span>');
    expect(hl('#[:a]')).toContain('<span class="set">#[</span>');
    expect(hl('{:a 1}')).toContain('<span class="map">}</span>');
    expect(hl('!{}')).toBe('<span class="error">!{</span><span class="error">}</span>');
  });

  it('paints the prose of a doc as a doc, a comment as a comment, and a token inside a quote italic beside its kind', () => {
    expect(hl('|~~ a ~(count) ~~| |~ b ~|')).toBe('<span class="doc">|~~ a </span><span class="quote">~(</span><span class="verb italic">count</span><span class="quote">)</span><span class="doc"> ~~|</span><span class="whitespace"> </span><span class="comment">|~ b ~|</span>');
  });

  it('paints a source the parser reads none of as unparsed, its HTML escaped', () => {
    expect(hl(')))')).toBe('<span class="unparsed">)))</span>');
    expect(hl('a<b')).toBe('<span class="unparsed">a&lt;b</span>');
  });

  it('writes no angle bracket but those of its spans', () => {
    expect(hl('[1 2] | filter ~(gt 1)')).not.toMatch(/<(?!\/?span)/);
  });
});
