import { describe, it, expect, beforeAll } from 'vitest';
import { parse, walkAst, langRuntime } from '@kaluchi/qlang-core';
import { highlightQlang } from '../src/lib/qlang-highlight.js';

let builtins;
beforeAll(async () => {
  const runtime = await langRuntime();
  builtins = new Set([...runtime.keys()].map(k => k.name));
});

const hl = src => highlightQlang(src, parse, walkAst, builtins);

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

// ── Keywords / atoms ──────────────────────────────────────────

describe('keyword atoms', () => {
  it('wraps :name in atom span', () => {
    expect(hl(':foo')).toBe('<span class="atom">:foo</span>');
  });

  it('wraps :@name in effect span', () => {
    expect(hl(':@log')).toBe('<span class="effect">:@log</span>');
  });
});

// ── Operand calls ─────────────────────────────────────────────

describe('builtin operands', () => {
  it('wraps builtin name in operand span', () => {
    const out = hl('count');
    expect(out).toBe('<span class="operand">count</span>');
  });

  it('let keyword gets keyword span, not operand', () => {
    const out = hl('let(:x, 1)');
    expect(out).toContain('<span class="keyword">let</span>');
    expect(out).not.toContain('<span class="operand">let</span>');
  });

  it('as keyword gets keyword span', () => {
    const out = hl('1 | as(:x)');
    expect(out).toContain('<span class="keyword">as</span>');
  });

  it('@-prefixed call gets effect span', () => {
    const out = hl('let(:@log, []) | 42 | @log');
    expect(out).toContain('<span class="effect">@log</span>');
  });

  it('user-defined name gets atom span (not operand)', () => {
    const out = hl('let(:double, mul(2)) | 10 | double');
    expect(out).toContain('<span class="atom">double</span>');
    expect(out).not.toContain('<span class="operand">double</span>');
  });
});

// ── Projections ───────────────────────────────────────────────

describe('projections', () => {
  it('renders slash as punct and field as operand', () => {
    const out = hl('/name');
    expect(out).toContain('<span class="punct">/</span>');
    expect(out).toContain('<span class="operand">name</span>');
  });

  it('renders nested projection correctly', () => {
    const out = hl('/a/b');
    expect(out.match(/<span class="operand">/g)).toHaveLength(2);
    expect(out.match(new RegExp('<span class="punct">/</span>', 'g'))).toHaveLength(2);
  });
});

// ── Combinators / punctuation ─────────────────────────────────

describe('punctuation', () => {
  it('pipe | becomes punct', () => {
    const out = hl('1 | add(1)');
    expect(out).toContain('<span class="punct">|</span>');
  });

  it('distribute * becomes punct', () => {
    const out = hl('[1 2] * add(1)');
    expect(out).toContain('<span class="punct">*</span>');
  });

  it('merge >> becomes punct', () => {
    const out = hl('1 >> 2');
    expect(out).toContain('<span class="punct">&gt;&gt;</span>');
  });

  it('fail-track !| becomes punct', () => {
    const out = hl('1 !| 2');
    expect(out).toContain('<span class="punct">!|</span>');
  });

  it('parens become punct', () => {
    const out = hl('add(1)');
    expect(out).toContain('<span class="punct">(</span>');
    expect(out).toContain('<span class="punct">)</span>');
  });

  it('brackets become punct', () => {
    const out = hl('[1 2]');
    expect(out).toContain('<span class="punct">[</span>');
    expect(out).toContain('<span class="punct">]</span>');
  });
});

// ── Error fallback ────────────────────────────────────────────

describe('parse error fallback', () => {
  it('returns escaped plain text on parse failure', () => {
    const out = hl('[unclosed');
    expect(out).not.toContain('<span');
    expect(out).toContain('[unclosed');
  });

  it('HTML-escapes angle brackets in fallback', () => {
    const out = hl('a<b');
    expect(out).toContain('&lt;');
    expect(out).not.toContain('<span');
  });
});

// ── Full pipeline ─────────────────────────────────────────────

describe('full expressions', () => {
  it('pipeline produces expected span sequence', () => {
    const out = hl('[1 2 3] | count');
    expect(out).toContain('<span class="number">1</span>');
    expect(out).toContain('<span class="number">2</span>');
    expect(out).toContain('<span class="number">3</span>');
    expect(out).toContain('<span class="punct">|</span>');
    expect(out).toContain('<span class="operand">count</span>');
  });

  it('no raw < or > in output (always escaped)', () => {
    const out = hl('[1 2] | filter(gt(1))');
    expect(out).not.toMatch(/<(?!\/?span)/);
  });
});
