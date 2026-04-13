import { describe, it, expect, beforeAll } from 'vitest';
import { parse, walkAst, langRuntime } from '../../src/index.mjs';
import { formatExample } from '../src/lib/format-example.js';

let builtins;
beforeAll(async () => {
  const runtime = await langRuntime();
  builtins = new Set([...runtime.keys()].map(k => k.name));
});

const fmt = code => formatExample(code, parse, walkAst, builtins);

// ── Line classification ───────────────────────────────────────

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
  it('">" prefix becomes punct span, expression is highlighted', () => {
    const out = fmt('> count');
    expect(out).toContain('<span class="punct">&gt; </span>');
    expect(out).toContain('<span class="operand">count</span>');
  });

  it('strips "> " before passing to highlighter', () => {
    // If "> " were not stripped, the > would confuse the parser.
    const out = fmt('> 42');
    expect(out).toContain('<span class="number">42</span>');
    expect(out).not.toContain('&gt; <span class="number">');
  });
});

describe('continuation lines', () => {
  it('two-space indent preserved, expression highlighted', () => {
    const out = fmt('  add(1)');
    expect(out.startsWith('  ')).toBe(true);
    expect(out).toContain('<span class="operand">add</span>');
  });
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

// ── Multi-line blocks ─────────────────────────────────────────

describe('multi-line blocks', () => {
  it('all four line types render in correct order', () => {
    const src = [
      '|~| label',
      '> [1 2 3] | count',
      '3'
    ].join('\n');
    const lines = fmt(src).split('\n');
    expect(lines[0]).toContain('class="comment"');
    expect(lines[1]).toContain('class="punct"');  // the "> " span
    expect(lines[2]).toContain('<span class="number">3</span>');
  });

  it('multi-line expression: prompt + continuation share highlighting context', () => {
    const src = [
      '> let(:double, mul(2))',
      '  | [10 20] * double'
    ].join('\n');
    const lines = fmt(src).split('\n');
    // prompt line has the > punct prefix
    expect(lines[0]).toContain('<span class="punct">&gt; </span>');
    // continuation line starts with two spaces
    expect(lines[1].startsWith('  ')).toBe(true);
    // the continuation body is highlighted (double is user-defined → atom)
    expect(lines[1]).toContain('<span class="atom">double</span>');
  });

  it('multiple prompt lines each get their own > prefix', () => {
    const src = '> count\n> add(1)';
    const lines = fmt(src).split('\n');
    expect(lines[0]).toContain('&gt; ');
    expect(lines[1]).toContain('&gt; ');
  });
});

// ── Real example block ────────────────────────────────────────

describe('real landing page example', () => {
  it('pipeline example renders without throwing', () => {
    const src = '|~| Vec → filter → count\n> [1 2 3 4 5] | filter(gt(3)) | count\n2';
    expect(() => fmt(src)).not.toThrow();
    const out = fmt(src);
    expect(out).toContain('class="comment"');
    expect(out).toContain('class="operand"');
    expect(out).toContain('<span class="number">2</span>');
  });
});
