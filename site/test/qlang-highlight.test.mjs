// The rules it holds: [QSWRK#tooling].

import { describe, it, expect, beforeAll } from 'vitest';
import { langRuntime, verbNames } from '@kaluchi/qlang-core';
import { highlightQlang } from '../src/lib/qlang-highlight.js';

let rootVerbNames;
beforeAll(async () => {
  const scope = await langRuntime();
  rootVerbNames = verbNames(scope);
});

const hl = src => highlightQlang(src, rootVerbNames);

// ── Literal types ─────────────────────────────────────────────

describe('string literals', () => {
  it('wraps in string span', () => {
    expect(hl('"hello"')).toBe('<span class="string">"hello"</span>');
  });

  it('escapes HTML inside string', () => {
    const out = hl('"a<b"');
    expect(out).toContain('&lt;');
    expect(out).toContain('class="string"');
  });
});

describe('number literals', () => {
  it('wraps integer in number span', () => {
    expect(hl('42')).toBe('<span class="number">42</span>');
  });

  it('wraps float in number span', () => {
    expect(hl('3.14')).toBe('<span class="number">3.14</span>');
  });
});

describe('boolean and null literals', () => {
  it('wraps true in number span', () => {
    expect(hl('true')).toBe('<span class="number">true</span>');
  });

  it('wraps false in number span', () => {
    expect(hl('false')).toBe('<span class="number">false</span>');
  });

  it('wraps null in number span', () => {
    expect(hl('null')).toBe('<span class="number">null</span>');
  });
});

// ── Keywords as names ──────────────────────────────────────────

describe('keywords as names', () => {
  it('wraps :name in a name span', () => {
    expect(hl(':foo')).toBe('<span class="name">:foo</span>');
  });
});

// ── Calls of verbs ─────────────────────────────────────────────

describe('the verbs of the language', () => {
  it('wraps the name of a verb in a word span', () => {
    const out = hl('count');
    expect(out).toBe('<span class="word">count</span>');
  });

  it('BindStep key gets keyword span', () => {
    const out = hl(':x 1');
    expect(out).toContain('<span class="keyword">:x</span>');
  });

  it('the name of a reader gets a name span, not a word span', () => {
    const out = hl(':double mul 2 | 10 | double');
    expect(out).toContain('<span class="name">double</span>');
    expect(out).not.toContain('<span class="word">double</span>');
  });
});

// ── Paths ──────────────────────────────────────────────────────

describe('paths', () => {
  it('renders slash as punct and field as word', () => {
    const out = hl('/name');
    expect(out).toContain('<span class="punct">/</span>');
    expect(out).toContain('<span class="word">name</span>');
  });

  it('renders a path at depth, each key a word after its slash', () => {
    const out = hl('/a/b');
    expect(out.match(/<span class="word">/g)).toHaveLength(2);
    expect(out.match(new RegExp('<span class="punct">/</span>', 'g'))).toHaveLength(2);
  });
});

// ── Combinators / punctuation ─────────────────────────────────

describe('punctuation', () => {
  it('pipe | becomes punct', () => {
    const out = hl('1 | add 1');
    expect(out).toContain('<span class="punct">|</span>');
  });

  it('fail-track !| becomes err', () => {
    const out = hl('1 !| /k');
    expect(out).toContain('<span class="err">!|</span>');
  });

  it('the parentheses of a group become punct', () => {
    const out = hl('take (count | sub 1)');
    expect(out).toContain('<span class="punct">(</span>');
    expect(out).toContain('<span class="punct">)</span>');
  });

  it('vec brackets become vec', () => {
    const out = hl('[1 2]');
    expect(out).toContain('<span class="vec">[</span>');
    expect(out).toContain('<span class="vec">]</span>');
  });

  it('set brackets become set', () => {
    const out = hl('#[:a]');
    expect(out).toContain('<span class="set">#[</span>');
    expect(out).toContain('<span class="set">]</span>');
  });

  it('map braces stay as punct', () => {
    const out = hl('{:a 1}');
    expect(out).toContain('<span class="punct">{</span>');
    expect(out).toContain('<span class="punct">}</span>');
  });

  it('`!{` / `}` of an error literal become err', () => {
    const out = hl('!{}');
    expect(out).toContain('<span class="err">!{</span>');
    expect(out).toContain('<span class="err">}</span>');
  });
});

// ── Error fallback ────────────────────────────────────────────

describe('parse error fallback', () => {
  it('returns escaped plain text for a source the parser reads none of', () => {
    const out = hl(')))');
    expect(out).not.toContain('<span');
    expect(out).toContain(')))');
  });

  it('HTML-escapes angle brackets in fallback', () => {
    const out = hl('a<b');
    expect(out).toContain('&lt;');
    expect(out).not.toContain('<span');
  });
});

// ── Full pipeline ─────────────────────────────────────────────

describe('full queries', () => {
  it('pipeline produces expected span sequence', () => {
    const out = hl('[1 2 3] | count');
    expect(out).toContain('<span class="number">1</span>');
    expect(out).toContain('<span class="number">2</span>');
    expect(out).toContain('<span class="number">3</span>');
    expect(out).toContain('<span class="vec">[</span>');
    expect(out).toContain('<span class="vec">]</span>');
    expect(out).toContain('<span class="punct">|</span>');
    expect(out).toContain('<span class="word">count</span>');
  });

  it('no raw < or > in output (always escaped)', () => {
    const out = hl('[1 2] | filter ~(gt 1)');
    expect(out).not.toMatch(/<(?!\/?span)/);
  });
});
