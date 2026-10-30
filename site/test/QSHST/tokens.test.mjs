import { describe, it, expect, beforeAll } from 'vitest';
import { langRuntime, verbNames } from '@kaluchi/qlang-core';
import { formatExample } from '../../src/lib/format-example.js';
import { highlightQlang } from '../../src/lib/qlang-highlight.js';

let rootVerbNames;
beforeAll(async () => {
  const scope = await langRuntime();
  rootVerbNames = verbNames(scope);
});

const fmt = code => formatExample(code, rootVerbNames);

describe('comment lines', () => {
  it('|~| line becomes comment span', () => {
    const out = fmt('|~| Vec → filter');
    expect(out).toBe('<span class="comment">|~| Vec → filter</span>');
  });

  it('HTML-escapes content inside comment', () => {
    const out = fmt('|~| a<b>c');
    expect(out).toContain('&lt;');
    expect(out).toContain('&gt;');
    expect(out).toContain('class="comment"');
  });
});

describe('prompt lines', () => {
  it('">" prefix becomes a span of the prompt, the class of no kind of a token, the query is highlighted', () => {
    const out = fmt('> count');
    expect(out).toContain('<span class="prompt">&gt; </span>');
    expect(out).toContain('<span class="verb">count</span>');
  });

  it('strips "> " before passing to highlighter', () => {
    // If "> " were not stripped, the > would confuse the parser.
    const out = fmt('> 42');
    expect(out).toContain('<span class="number">42</span>');
    expect(out).not.toContain('&gt; <span class="number">');
  });
});

it('keeps the indent of two spaces of a continuation line, the query highlighted', () => {
  const out = fmt('  add 1');
  expect(out.startsWith('  ')).toBe(true);
  expect(out).toContain('<span class="verb">add</span>');
});

describe('result lines', () => {
  it('plain result line is highlighted as qlang', () => {
    const out = fmt('42');
    expect(out).toContain('<span class="number">42</span>');
  });

  it('string result is wrapped in string span', () => {
    const out = fmt('"hello"');
    expect(out).toContain('<span class="string">"hello"</span>');
  });
});

describe('multi-line blocks', () => {
  it('all four line types render in correct order', () => {
    const src = [
      '|~| label',
      '> [1 2 3] | count',
      '3'
    ].join('\n');
    const lines = fmt(src).split('\n');
    expect(lines[0]).toContain('class="comment"');
    expect(lines[1]).toContain('class="prompt"');  // the "> " span
    expect(lines[2]).toContain('<span class="number">3</span>');
  });

  it('a query of several lines: prompt + continuation share highlighting context', () => {
    const src = [
      '> :double mul 2;',
      '  [10 20] | map double'
    ].join('\n');
    const lines = fmt(src).split('\n');
    // prompt line has the > prompt prefix
    expect(lines[0]).toContain('<span class="prompt">&gt; </span>');
    // continuation line starts with two spaces
    expect(lines[1].startsWith('  ')).toBe(true);
    // the continuation body is highlighted (double, the reader's name the prompt line declares)
    expect(lines[1]).toContain('<span class="name">double</span>');
  });

  it('multiple prompt lines each get their own > prefix', () => {
    const src = '> count\n> add 1';
    const lines = fmt(src).split('\n');
    expect(lines[0]).toContain('&gt; ');
    expect(lines[1]).toContain('&gt; ');
  });
});

it('paints the example of the landing page without a throw', () => {
  const src = '|~| Vec → filter → count\n> [1 2 3 4 5] | filter ~(gt 3) | count\n2';
  expect(() => fmt(src)).not.toThrow();
  const out = fmt(src);
  expect(out).toContain('class="comment"');
  expect(out).toContain('class="verb"');
  expect(out).toContain('<span class="number">2</span>');
});

beforeAll(async () => {
  const scope = await langRuntime();
  rootVerbNames = verbNames(scope);
});

const hl = src => highlightQlang(src, rootVerbNames);

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

describe('a name', () => {
  it('is a verb where it calls a word of the root', () => {
    expect(hl('count')).toBe('<span class="verb">count</span>');
  });

  it('is a declaration where a declaration writes it', () => {
    expect(hl(':x 1;')).toContain('<span class="declaration">:x</span>');
  });

  it('is a name where it calls a reader\'s, and wherever no names of the root\'s words are handed', () => {
    const out = hl(':double mul 2; 10 | double');
    expect(out).toContain('<span class="name">double</span>');
    expect(highlightQlang('count', null)).toBe('<span class="name">count</span>');
  });
});

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
    expect(hl('[1 2] | filter (gt 1)')).not.toMatch(/<(?!\/?span)/);
  });
});
