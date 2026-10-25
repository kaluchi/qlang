import { describe, it, expect } from 'vitest';
import { parseDocument, documentSymbols, foldingRangesOf } from '../../src/features.mjs';
import { langRuntime } from '@kaluchi/qlang-core';
import { spawn } from 'node:child_process';
import { CompletionItemKind, SymbolKind } from 'vscode-languageserver/node';
import { answerOf, framedMessage, serverPath } from '../helpers/server-process.mjs';

describe('the folds', () => {
  const foldsOf = src => foldingRangesOf(parseDocument(src, 'test.qlang').root);

  it('folds a declaration, its doc as a comment, and a quote, each to the line where its last part ends', () => {
    const src = [':double', '  |~~ Doubles.', '      ~(', '        2 | double', '      )', '  ~~|', '  ~(mul 2)', ':x 1'].join('\n');
    expect(foldsOf(src)).toEqual([
      { startLine: 0, endLine: 6, kind: 'region' },
      { startLine: 1, endLine: 4, kind: 'comment' },
      { startLine: 2, endLine: 3, kind: 'region' }
    ]);
  });

  it('ends the fold of a declaration of docs alone and of a doc on the line where the text of its doc ends, before its closer', () => {
    expect(foldsOf([':Box', '  |~~ A box', '      of parts.', '  ~~|'].join('\n'))).toEqual([
      { startLine: 0, endLine: 2, kind: 'region' },
      { startLine: 1, endLine: 2, kind: 'comment' }
    ]);
    expect(foldsOf(['|~~ A box', '    of parts. ~~|'].join('\n'))).toEqual([{ startLine: 0, endLine: 1, kind: 'comment' }]);
  });

  it('folds no quote that holds no step', () => {
    expect(foldsOf(['get [~(', '  |~| none', ')]'].join('\n'))).toEqual([]);
  });

  it('folds nothing for a text that does not parse', () => {
    expect(foldingRangesOf(null)).toEqual([]);
  });
});

describe('the symbols of a document', () => {
  it('collects the verbs a reader declares under a label as verb symbols', async () => {
    const src = ':number/double ~(mul 2) | :number/triple ~(mul 3) | :q ~(add 1)';
    const { root } = parseDocument(src, 'test.qlang');
    const syms = documentSymbols(root, await langRuntime());
    expect(syms).toHaveLength(3);
    expect(syms[0].name).toBe('number/double');
    expect(syms[0].role).toBe('verb');
    expect(syms[2].role).toBe('value');
    expect(syms[1].name).toBe('number/triple');
    expect(syms[1].role).toBe('verb');
  });

  it('shows a label of the document and the verbs under it as the core reads them', async () => {
    const src = ':Box |~~ A box. ~~| | :Box/area ~(1) | :Ring/area ~(2)';
    const { root } = parseDocument(src, 'test.qlang');
    const syms = documentSymbols(root, await langRuntime());
    expect(syms.map(sym => [sym.name, sym.role])).toEqual([
      ['::Box', 'label'], ['Box/area', 'verb'], ['Ring/area', 'value']
    ]);
  });

  it('shows a kind built from ::kind as a label and a function under it as a verb, whatever its recipe', async () => {
    const src = [
      ':Box',
      '  |~~ A parcel. ~~|',
      '  ::kind',
      '    | accepts |~~ The sizes. ~~| ::map',
      '| :Crate |~~ A crate. ~~| (::kind | accepts |~~ The goods. ~~| ::vec)',
      '| :Box/area |~~ The area. ~~| (::fn | returns |~~ A number. ~~| ::number | impl ~(mulOf /w /h))',
      '| :Box/rule |~~ A contract. ~~| (::fn | returns |~~ A number. ~~| ::number)',
      '| :Crate/count |~~ The goods. ~~| ::fn[~() ~(count)]',
      '| :Crate/size |~~ A contract. ~~| ::fn[~() null]',
      '| :f |~~ A function. ~~| (::fn | impl ~(add 1))'
    ].join('\n');
    const { root } = parseDocument(src, 'test.qlang');
    expect(documentSymbols(root, await langRuntime()).map(sym => [sym.name, sym.role])).toEqual([
      ['::Box', 'label'], ['::Crate', 'label'], ['Box/area', 'verb'], ['Box/rule', 'verb'], ['Crate/count', 'verb'], ['Crate/size', 'verb'], ['f', 'value']
    ]);
  });

  it('shows a reader\'s ::builtin{} under a label as a verb, which its call refuses for the primitive it holds none', async () => {
    const src = ':Box |~~ B. ~~| | :Box/area ::builtin{}';
    const { root } = parseDocument(src, 'test.qlang');
    expect(documentSymbols(root, await langRuntime()).map(sym => sym.role)).toEqual(['label', 'verb']);
  });

  it('collects a binding of a computed body as a value symbol', async () => {
    const src = '[1 2] | :n count';
    const { root } = parseDocument(src, 'test.qlang');
    const syms = documentSymbols(root, await langRuntime());
    expect(syms).toHaveLength(1);
    expect(syms[0].role).toBe('value');
  });

  it('collects a declaration of it as a value symbol', async () => {
    const src = '42 | :answer it';
    const { root } = parseDocument(src, 'test.qlang');
    const syms = documentSymbols(root, await langRuntime());
    expect(syms).toHaveLength(1);
    expect(syms[0].name).toBe('answer');
    expect(syms[0].role).toBe('value');
  });

  it('returns empty for plain pipeline with no bindings', async () => {
    const src = '[1 2 3] | count';
    const { root } = parseDocument(src, 'test.qlang');
    expect(documentSymbols(root, await langRuntime())).toHaveLength(0);
  });

  it('returns empty for a text that does not parse', async () => {
    expect(documentSymbols(null, await langRuntime())).toEqual([]);
  });
});

it('names a declaration of a document by its role, a verb a function, a value a variable and a label a struct of the protocol', async () => {
  const serverProcess = spawn(process.execPath, [serverPath, '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    const initialized = answerOf(serverProcess, 1);
    serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { processId: null, rootUri: null, capabilities: {} } }));
    await initialized;
    const uri = 'file:///roles.qlang';
    const text = ':Box |~~ A box. ~~| | :Box/area ~(1) | :n 1 | n';
    serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'qlang', version: 1, text } } }));
    const symbols = answerOf(serverProcess, 2);
    serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', id: 2, method: 'textDocument/documentSymbol', params: { textDocument: { uri } } }));
    expect((await symbols).result.map(({ name, kind }) => [name, kind])).toEqual([['::Box', SymbolKind.Struct], ['Box/area', SymbolKind.Function], ['n', SymbolKind.Variable]]);
    const completions = answerOf(serverProcess, 3);
    serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', id: 3, method: 'textDocument/completion', params: { textDocument: { uri }, position: { line: 0, character: text.length } } }));
    const kinds = new Map((await completions).result.map(({ label, kind }) => [label, kind]));
    expect(['area', 'n', '::Box'].map(label => kinds.get(label))).toEqual([CompletionItemKind.Function, CompletionItemKind.Variable, CompletionItemKind.Struct]);
  } finally {
    serverProcess.kill();
  }
}, 30_000);
