import { describe, it, expect } from 'vitest';
import { parseDocument, semanticTokensFor, SEMANTIC_TOKEN_TYPES } from '../../src/features.mjs';
import { langRuntime, verbNames } from '@kaluchi/qlang-core';
import { tokenize } from '@kaluchi/qlang-core/highlight';
import { spawn } from 'node:child_process';
import { answerOf, framedMessage, serverPath } from '../helpers/server-process.mjs';
import { decodeSemanticTokens } from '../helpers/semantic-tokens.mjs';

describe('the diagnostics of a document', () => {
  it('parses valid qlang source without diagnostics', () => {
    const { root, diagnostics } = parseDocument('[1 2 3] | count', 'test.qlang');
    expect(root.parts).toHaveLength(2);
    expect(diagnostics).toHaveLength(0);
  });

  it('returns a diagnostic for a parse error', () => {
    const { root, diagnostics } = parseDocument('[1 2 3', 'test.qlang');
    expect(root).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].message).toBeTruthy();
  });

  it('diagnostic has source location', () => {
    const { diagnostics } = parseDocument('| |', 'test.qlang');
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]).toHaveProperty('startLine');
    expect(diagnostics[0]).toHaveProperty('startChar');
  });
});

describe('the semantic tokens', () => {
  const EVERY_KIND = ':x |~~ d ~~| [null true 1 "s" #"r" :k /a ::T !{} #[1] {:a 1}]; filter ~(gt 1) !| count | (x) |~| c';
  const UNCOATED = new Set(['vec', 'set', 'map', 'group', 'punctuation', 'whitespace', 'unparsed']);

  it('coats each kind of the core\'s tokens but a bracket and a gap by a type of its legend, which holds each type once', async () => {
    const coated = tokenize(EVERY_KIND, verbNames(await langRuntime())).filter(token => !UNCOATED.has(token.kind));
    const sent = decodeSemanticTokens((await semanticTokensFor(EVERY_KIND)).data, SEMANTIC_TOKEN_TYPES);
    expect(sent.map(({ char, length }) => EVERY_KIND.slice(char, char + length))).toEqual(coated.map(({ start, end }) => EVERY_KIND.slice(start, end)));
    for (const { type } of sent) expect(SEMANTIC_TOKEN_TYPES).toContain(type);
    expect(SEMANTIC_TOKEN_TYPES).toEqual([...new Set(SEMANTIC_TOKEN_TYPES)]);
  });

  it('coats a call of a verb of the root apart from a name of the reader', async () => {
    const src = ':double ~(mul 2); 5 | apply double';
    const tokens = decodeSemanticTokens((await semanticTokensFor(src)).data, SEMANTIC_TOKEN_TYPES);
    const typeAt = offset => tokens.find(({ char }) => char === offset).type;
    expect(typeAt(src.indexOf('apply'))).not.toBe(typeAt(src.lastIndexOf('double')));
  });

  it('splits a multi-line comment into per-line entries', async () => {
    const src = '|~ multi-\nline plain ~|\n42';
    const { data } = await semanticTokensFor(src);
    const tokens = decodeSemanticTokens(data, SEMANTIC_TOKEN_TYPES);
    const commentTokens = tokens.filter(t => t.type === 'comment');
    expect(commentTokens.length).toBeGreaterThanOrEqual(2);
  });

  it('emits well-formed 5-int stream', async () => {
    const { data } = await semanticTokensFor('[1 2 3] | filter ~(gt 1) | count');
    expect(data.length % 5).toBe(0);
    for (let i = 2; i < data.length; i += 5) {
      expect(data[i]).toBeGreaterThan(0);
    }
  });

  it('returns empty data for empty source', async () => {
    const { data } = await semanticTokensFor('');
    expect(data.length).toBe(0);
  });

  it('returns empty data for a source the parser reads none of', async () => {
    expect((await semanticTokensFor(')))')).data.length).toBe(0);
  });

  it('returns the tokens of a source cut short, as it is typed', async () => {
    expect((await semanticTokensFor('[1 2 3')).data.length).toBeGreaterThan(0);
  });
});

it('starts over stdio and answers initialize with its capabilities', async () => {
  const serverProcess = spawn(process.execPath, [serverPath, '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    const answer = answerOf(serverProcess, 1);
    serverProcess.stdin.write(framedMessage({
      jsonrpc: '2.0', id: 1, method: 'initialize', params: { processId: null, rootUri: null, capabilities: {} }
    }));
    const response = await answer;
    expect(response.result.capabilities.hoverProvider).toBe(true);
    expect(response.result.capabilities.signatureHelpProvider.triggerCharacters).toEqual([' ']);
  } finally {
    serverProcess.kill();
  }
}, 30_000);
