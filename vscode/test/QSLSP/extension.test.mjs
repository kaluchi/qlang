// The extension of the editor paints a block of qlang in a preview of markdown
// by the core's tokens, plain until the core's painter loads and every call a
// name until the root hands over the names of its words, each kind coated by a
// class of highlight.js, and selects a word by the regex of a name the core
// exports, the language server folding a document.

import { describe, it, expect, vi } from 'vitest';
import Module, { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { tokenize } from '@kaluchi/qlang-core/highlight';
import { langRuntime, verbNames, NAME_REGEX } from '@kaluchi/qlang-core';

const require = createRequire(import.meta.url);
const { blockHtml } = require('../../src/markdown-block.js');

const loaded = async () => ({ tokenize, verbNames: verbNames(await langRuntime()) });

describe('a block of qlang in a preview of markdown', () => {
  it('is written plain while the core\'s painter has not loaded', () => {
    expect(blockHtml('[1] | count', { tokenize: null, verbNames: new Set() })).toBe('');
  });

  it('paints every call as a name until the root hands over the names of its words', async () => {
    const unloaded = { tokenize, verbNames: new Set() };
    expect(blockHtml('count', unloaded)).toBe(blockHtml('x', await loaded()).replace('>x<', '>count<'));
    expect(blockHtml('count', await loaded())).not.toBe(blockHtml('count', unloaded));
  });

  it('coats each kind of the core\'s tokens by a class of highlight.js, a token inside a quote leaning and whitespace plain', async () => {
    const source = ':x |~~ d ~~| [null true 1 "s" #"r" :k /a ::T !{} #[1] {:a 1}] | filter ~(gt 1) !| count | (x) |~| c';
    const painter = await loaded();
    let rest = blockHtml(source, painter);
    for (const { start, end, kind, italic } of tokenize(source, painter.verbNames)) {
      const text = source.slice(start, end);
      const span = /^<span class="(?:(?!hljs-emphasis)(hljs-[a-z_]+))?(?: ?(hljs-emphasis))?">/.exec(rest);
      if (kind === 'whitespace' && !italic) {
        expect(rest.startsWith(text), kind).toBe(true);
        rest = rest.slice(text.length);
        continue;
      }
      expect([kind, span?.[1] !== undefined, span?.[2] !== undefined]).toEqual([kind, kind !== 'whitespace', italic === true]);
      expect(rest.slice(span[0].length).startsWith(`${text}</span>`), kind).toBe(true);
      rest = rest.slice(span[0].length + text.length + '</span>'.length);
    }
    expect(rest).toBe('');
  });

  it('paints each query after its prompt with the indented lines that continue it, and the answer below it, a blank line between them', async () => {
    const block = '> [3 1 2]\n  | sort\n[1 2 3]\n\n> "a<b"\n"a<b"\n';
    expect(blockHtml(block, await loaded()).split('\n')).toEqual([
      '<span class="hljs-meta">&gt; </span><span class="hljs-punctuation">[</span><span class="hljs-number">3</span> <span class="hljs-number">1</span> <span class="hljs-number">2</span><span class="hljs-punctuation">]</span>',
      '  <span class="hljs-punctuation">|</span> <span class="hljs-built_in">sort</span>',
      '<span class="hljs-punctuation">[</span><span class="hljs-number">1</span> <span class="hljs-number">2</span> <span class="hljs-number">3</span><span class="hljs-punctuation">]</span>',
      '',
      '<span class="hljs-meta">&gt; </span><span class="hljs-string">"a&lt;b"</span>',
      '<span class="hljs-string">"a&lt;b"</span>',
      ''
    ]);
  });

  it('reads the lines of an answer as one source, and a prompt alone as a query of nothing', async () => {
    expect(blockHtml('> 1\n|~| a note\n2\n>', await loaded()).split('\n')).toEqual([
      '<span class="hljs-meta">&gt; </span><span class="hljs-number">1</span>',
      '<span class="hljs-comment">|~| a note</span>',
      '<span class="hljs-number">2</span>',
      '<span class="hljs-meta">&gt;</span>'
    ]);
  });

  it('ends a query at a line of whitespace alone, the lines after it an answer', async () => {
    expect(blockHtml('> 1\n  \n  "a"', await loaded()).split('\n')).toEqual([
      '<span class="hljs-meta">&gt; </span><span class="hljs-number">1</span>',
      '  ',
      '  <span class="hljs-string">"a"</span>'
    ]);
  });

  it('ends an answer at a blank line, the lines after it another', async () => {
    expect(blockHtml('> 1\n"a\n\n"b"', await loaded()).split('\n')).toEqual([
      '<span class="hljs-meta">&gt; </span><span class="hljs-number">1</span>',
      '<span class="hljs-string">"a</span>',
      '',
      '<span class="hljs-string">"b"</span>'
    ]);
  });

  it('reads a block that holds no prompt as one source, across its blank lines', async () => {
    expect(blockHtml(':x |~~ a\n\nb ~~| 1', await loaded())).toBe('<span class="hljs-keyword">:x</span> <span class="hljs-comment">|~~ a\n\nb ~~|</span> <span class="hljs-number">1</span>');
  });
});

// The extension activated with the editor's API and the client of the
// language server stood in for, which the process of a test does not hold.
function activated() {
  const configured = [];
  const stood = new Map([
    ['vscode', { languages: { setLanguageConfiguration: (language, configuration) => configured.push([language, configuration]) } }],
    ['vscode-languageclient/node', { TransportKind: { stdio: 0 }, LanguageClient: class { start() {} stop() {} } }]
  ]);
  const load = Module._load;
  Module._load = function (request, ...rest) {
    return stood.has(request) ? stood.get(request) : load.call(this, request, ...rest);
  };
  try {
    const extension = require('../../src/extension.js');
    const context = { subscriptions: [] };
    return { extension, context, configured, plugin: extension.activate(context) };
  } finally {
    Module._load = load;
  }
}

describe('the extension', () => {
  it('paints a block of qlang plain until the core loads and by its tokens after, leaves a block of another language to the highlighter before it, and selects a word by the regex of a name the core exports', async () => {
    const { extension, context, configured, plugin } = activated();
    const md = plugin.extendMarkdownIt({ options: { highlight: (code, lang) => `${lang}: ${code}` } });
    expect(md.options.highlight('count', 'qlang')).toBe('');
    expect(md.options.highlight('let x', 'js')).toBe('js: let x');
    await vi.waitFor(() => expect(md.options.highlight('count', 'qlang')).toBe('<span class="hljs-built_in">count</span>'), { timeout: 30_000, interval: 20 });
    expect(configured.map(([language, { wordPattern }]) => [language, wordPattern.source, wordPattern.flags])).toEqual([['qlang', NAME_REGEX.source, NAME_REGEX.flags]]);
    expect(context.subscriptions).toHaveLength(1);
    expect(plugin.extendMarkdownIt({ options: {} }).options.highlight('let x', 'js')).toBe('');
    await extension.deactivate();
  }, 60_000);

  it('keeps in the configuration of the language neither a regex of a word nor a marker of a fold, the core and the language server answering them', () => {
    const configuration = JSON.parse(readFileSync(new URL('../../language-configuration.json', import.meta.url), 'utf8'));
    expect([configuration.wordPattern, configuration.folding]).toEqual([undefined, undefined]);
  });
});
