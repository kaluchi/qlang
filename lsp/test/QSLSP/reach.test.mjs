import { describe, it, expect } from 'vitest';
import { parseDocument, buildCatalogIndex, completionsAtOffset, hoverAtOffset, definitionAtOffset, referencesAtOffset } from '../../src/features.mjs';
import { langRuntime, evalQuery } from '@kaluchi/qlang-core';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { cpSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { answerOf, framedMessage, lspDir } from '../helpers/server-process.mjs';

describe('the hover', () => {
  it('returns hover for a verb of the language', async () => {
    const src = '[1 2 3] | count';
    const { root } = parseDocument(src, 'test.qlang');
    const countOffset = src.indexOf('count');
    const hover = await hoverAtOffset(root, src, countOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/count/);
    expect(hover.content).toMatch(/::[a-z]+\/count/);
  });

  it('hover includes docs from manifest', async () => {
    const src = '[1 2 3] | filter ~(gt 2)';
    const { root } = parseDocument(src, 'test.qlang');
    const filterOffset = src.indexOf('filter');
    const hover = await hoverAtOffset(root, src, filterOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/predicate/i);
    expect(hover.content).not.toMatch(/~\{/);
  });

  it('returns hover for a path', async () => {
    const src = '{:name "alice"} | get /name';
    const { root } = parseDocument(src, 'test.qlang');
    const projOffset = src.indexOf('/name');
    const hover = await hoverAtOffset(root, src, projOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/path/);
    expect(hover.content).toMatch(/\/name/);
    expect(hover.content).toMatch(/names a part of another/);
  });

  it('returns hover for a keyword literal', async () => {
    const src = ':hello';
    const { root } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(root, src, 0);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/keyword/);
    expect(hover.content).toMatch(/:hello/);
  });

  it('hover has range', async () => {
    const src = '[1 2 3] | count';
    const { root } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(root, src, src.indexOf('count'));
    expect(hover).toHaveProperty('startOffset');
    expect(hover).toHaveProperty('endOffset');
    expect(hover.startOffset).toBeLessThan(hover.endOffset);
  });

  it('returns null for a text that does not parse', async () => {
    expect(await hoverAtOffset(null, '', 0)).toBeNull();
  });

  it('returns hover for a tag name', async () => {
    const src = '::number/NotFiniteError | doc';
    const { root } = parseDocument(src, 'test.qlang');
    const tagOffset = src.indexOf('::number/NotFiniteError') + 5;
    const hover = await hoverAtOffset(root, src, tagOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toContain("::number/NotFiniteError");
    expect(hover.content).toMatch(/a name of the root/);
  });

  it('returns hover for the head of a tagged literal', async () => {
    const src = '::number#2 | add 1';
    const { root } = parseDocument(src, 'test.qlang');
    const tagOffset = src.indexOf('::number') + 4;
    const hover = await hoverAtOffset(root, src, tagOffset);
    expect(hover).not.toBeNull();
    expect(hover.content).toMatch(/::number/);
    expect(hover.content).toMatch(/a name of the root/);
  });

  it('returns hover for the tag an error literal writes before its bang', async () => {
    // [QSERR#rest]
    const src = '::number/NotFiniteError!{:step 1}';
    const { root } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(root, src, 5);
    expect(hover).not.toBeNull();
    expect(hover.content).toContain("::number/NotFiniteError");
    expect(hover.endOffset - hover.startOffset).toBe('::number/NotFiniteError'.length);
    expect(await hoverAtOffset(root, src, src.indexOf('!{'))).toBeNull();
  });

  it('returns hover for `::error` written before a bang, and finds it among the references of `::error`', async () => {
    const src = '[::error!{:k 1} ::error]';
    const { root } = parseDocument(src, 'test.qlang');
    expect((await hoverAtOffset(root, src, 2)).content).toContain('**::error** — a name of the root');
    expect(referencesAtOffset(root, src.lastIndexOf('::error') + 2).map(({ startOffset }) => startOffset)).toEqual([1, 16]);
  });

  it('hover on ::Tag spans only the tag head, not the payload', async () => {
    const src = '::number#2 | add 1';
    const { root } = parseDocument(src, 'test.qlang');
    const tagOffset = src.indexOf('::number') + 4;
    const hover = await hoverAtOffset(root, src, tagOffset);
    expect(hover).not.toBeNull();
    expect(hover.endOffset - hover.startOffset).toBe('::number'.length);
  });

  it('returns the doc of a verb the document declares under a label, called by its name or its address', async () => {
    const src = ':number/double |~~ Doubles a number. ~~| ~(mul 2) | 10 | double | number/double';
    const { root } = parseDocument(src, 'test.qlang');
    for (const offset of [src.indexOf('| double') + 2, src.lastIndexOf('number/double')]) {
      const hover = await hoverAtOffset(root, src, offset);
      expect(hover.content).toMatch(/Doubles a number/);
    }
  });

  it('shows the page of a verb called in its own body, which calls itself by its name, and none for a value its own body names', async () => {
    const src = ':map/walk\n  |~~ Walks a tree. ~~|\n  ~(get {:n /n :kids ~(get /kids | map ~walk)})\n| {:n 1 :kids [{:n 2 :kids []}]} | walk | get /kids/0/n';
    expect((await hoverAtOffset(parseDocument(src, 'test.qlang').root, src, src.indexOf('~walk') + 1)).content).toBe("**walk** — a reader's name  \n  \nWalks a tree.  ");
    const value = ':n |~~ A number. ~~| (n | add 1)';
    expect(await hoverAtOffset(parseDocument(value, 'test.qlang').root, value, value.indexOf('(n') + 1)).toBeNull();
  });

  it('shows the content of each doc of a declaration of the document, its links written as the code they run', async () => {
    const src = ':x |~~ see ::link~(::vec | doc) here ~~| |~~| and a line\n  1\n| x';
    const { root } = parseDocument(src, 'test.qlang');
    const { content } = await hoverAtOffset(root, src, src.lastIndexOf('x'));
    expect([content.includes('see ::link~(::vec | doc) here'), content.includes('and a line')]).toEqual([true, true]);
  });

  it('shows nothing for a call that reaches no declaration of the document with docs, one a closed group holds among them', async () => {
    for (const [src, name] of [['(:x |~~ inner ~~| 1) | x', 'x'], [':x 1 | x', 'x'], ['nosuch', 'nosuch']]) {
      const { root } = parseDocument(src, 'test.qlang');
      expect(await hoverAtOffset(root, src, src.lastIndexOf(name)), src).toBeNull();
    }
  });

  it('shows a keyword by its literal, the key of a JSON literal among them', async () => {
    const src = '{"1": 2}';
    const { root } = parseDocument(src, 'test.qlang');
    expect((await hoverAtOffset(root, src, 2)).content).toBe('keyword `:"1"`');
  });

  it('shows nothing on the sign that joins a payload to its tag, past the head of the tag', async () => {
    const src = '::number#2 | add 1';
    const { root } = parseDocument(src, 'test.qlang');
    expect(await hoverAtOffset(root, src, src.indexOf('#'))).toBeNull();
  });

  it('shows the verb the subject of the call reaches, the form of its call over its page', async () => {
    for (const [src, address, words] of [['[1 2 3] | count', '::vec/count', 'elements the vector holds'], ['{:a 1} | count', '::map/count', 'entries the map holds'], ['#[1 2] | count', '::vec/count', 'elements the vector holds']]) {
      const { root } = parseDocument(src, 'test.qlang');
      const hover = await hoverAtOffset(root, src, src.indexOf('count'));
      expect(hover.content).toContain(`**count** — ${address}`);
      expect(hover.content).toContain(words);
    }
  });

  it('shows a verb with no subject under the address whose page it shows', async () => {
    const src = 'count';
    const { root } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(root, src, 0);
    const address = /— (::[A-Za-z/]+)/.exec(hover.content)[1];
    const page = await evalQuery(`${address} | doc | content`);
    expect(hover.content).toContain(page.trim().split('\n')[0].trim());
  });

  it('returns null for an offset outside any part', async () => {
    const src = '42';
    const { root } = parseDocument(src, 'test.qlang');
    const hover = await hoverAtOffset(root, src, 100);
    expect(hover).toBeNull();
  });
});

describe('the names a step reaches in the body of a verb, the verbs, the nodes and the labels around it wherever they stand and no value a reader named there', () => {
  const hoverOf = async (src, offset) => (await hoverAtOffset(parseDocument(src, 'test.qlang').root, src, offset))?.content ?? null;
  const gotoOf = async (src, offset) => (await definitionAtOffset(parseDocument(src, 'test.qlang').root, offset))?.startOffset ?? null;
  const pageOf = (name, prose) => `**${name}** — a reader's name  \n  \n${prose}  `;

  it('reaches a verb declared after the verb, one that calls it back among them, in the body of a verb under a label of the root and of the document alike', async () => {
    const later = ':vec/f ~(g) | :vec/g |~~ G. ~~| ~(7) | [1] | f';
    const mutual = ':vec/even |~~ E. ~~| ~(odd) | :vec/odd |~~ O. ~~| ~(1) | [1] | even';
    const underALabel = ':Box |~~ B. ~~| | :Box/f ~(g) | :vec/g |~~ G. ~~| ~(7) | ::Box[1] | f';
    expect([await hoverOf(later, later.indexOf('~(g)') + 2), await gotoOf(later, later.indexOf('~(g)') + 2), await hoverOf(mutual, mutual.indexOf('(odd)') + 1), await hoverOf(underALabel, underALabel.indexOf('~(g)') + 2)])
      .toEqual([pageOf('g', 'G.'), later.indexOf(':vec/g'), pageOf('odd', 'O.'), pageOf('g', 'G.')]);
    expect(await evalQuery(`get [~(${later}) ~(${mutual}) ~(${underALabel})]`)).toEqual([7, 1, 7]);
  });

  it('reaches no value a reader named outside the body, which the language refuses there, and the verb where a value of its name stands outside it', async () => {
    const value = 'apply ~(:k |~~ K. ~~| 1 | :vec/f ~(k) | [1] | f)';
    expect([await hoverOf(value, value.indexOf('~(k)') + 2), await gotoOf(value, value.indexOf('~(k)') + 2)]).toEqual([null, null]);
    expect(await evalQuery(`${value} !| get [~(tag) ~(name)]`)).toEqual(await evalQuery('[::call/UnknownNameError :k]'));
    const shadowed = 'apply ~(:f |~~ F value. ~~| 1 | :vec/f |~~ The verb. ~~| ~(if (count | gt 1) ~(drop 1 | f) ~(count)) | [1 2] | vec/f)';
    expect([await hoverOf(shadowed, shadowed.indexOf('| f)') + 2), await gotoOf(shadowed, shadowed.indexOf('| f)') + 2), await evalQuery(shadowed)])
      .toEqual([pageOf('f', 'The verb.'), shadowed.indexOf(':vec/f'), 1]);
  });

  it('reaches a declaration of the body before one outside it, and a name outside any verb\'s body as the declarations before it', async () => {
    const inner = ':vec/f |~~ The verb. ~~| ~(:k |~~ Inner. ~~| 1 | k) | :k |~~ Outer. ~~| 2 | [1] | f';
    const outside = ':k |~~ K. ~~| 1 | get [~(k)]';
    expect([await hoverOf(inner, inner.indexOf('| k)') + 2), await gotoOf(inner, inner.indexOf('| k)') + 2), await hoverOf(outside, outside.lastIndexOf('k')), await gotoOf(outside, outside.lastIndexOf('k'))])
      .toEqual([pageOf('k', 'Inner.'), inner.indexOf(':k'), pageOf('k', 'K.'), 0]);
  });

  it('completes in the body of a verb the names it reaches by their roles, a verb under a label declared after it among them', async () => {
    const src = ':k 1 | :vec/f ~(here) | :Late |~~ L. ~~| | :Late/g ~(1)';
    const roles = new Map((await completionsAtOffset(parseDocument(src, 'test.qlang').root, src.indexOf('here'), src)).map(item => [item.label, item.role]));
    expect(['f', 'g', 'Late', '::Late', 'k'].map(label => roles.get(label))).toEqual(['verb', 'verb', 'label', 'label', undefined]);
  });
});

const catalogSrc = ':vec/count ~(1) | :number/add ~(1)';
const catalogRoot = parseDocument(catalogSrc, 'qlang/any').root;
const testCatalogIndex = new Map();
for (const [name, range] of buildCatalogIndex(catalogRoot)) {
  testCatalogIndex.set(name, {
    ...range,
    fileUri: 'file:///test/core.qlang',
    source: catalogSrc
  });
}
const testCatalogCtx = { index: testCatalogIndex, scope: await langRuntime() };

describe('the jump to a declaration', () => {
  it('jumps from the use site of a verb to its declaration under a label', async () => {
    const src = ':number/double ~(mul 2) | 10 | double';
    const { root } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('double');
    const def = await definitionAtOffset(root, useOffset);
    expect(def).not.toBeNull();
    expect(def.startOffset).toBe(0);
    expect(def.fileUri).toBeUndefined();
  });

  it('jumps to last visible declaration when shadowed', async () => {
    const src = ':x 1 | :x 2 | x';
    const { root } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('x');
    const def = await definitionAtOffset(root, useOffset);
    expect(def).not.toBeNull();
    expect(def.startOffset).toBe(src.lastIndexOf(':x'));
  });

  it('declaration inside fork is invisible outside', async () => {
    const src = '(:x 1) | x';
    const { root } = parseDocument(src, 'test.qlang');
    const useOffset = src.lastIndexOf('x');
    const def = await definitionAtOffset(root, useOffset);
    expect(def === null || def.fileUri !== undefined).toBe(true);
  });

  it('jumps from a name several kinds answer to the first of its verbs the catalog declares', async () => {
    const src = '[1 2 3] | count';
    const { root } = parseDocument(src, 'test.qlang');
    const def = await definitionAtOffset(root, src.indexOf('count'), testCatalogCtx);
    expect(def).not.toBeNull();
    expect(def.fileUri).toBe('file:///test/core.qlang');
    expect(def.startOffset).toBe(0);
  });

  it('jumps from an address to the verb it names', async () => {
    const src = '[1 2 3] | vec/count';
    const { root } = parseDocument(src, 'test.qlang');
    const def = await definitionAtOffset(root, src.indexOf('vec/count'), testCatalogCtx);
    expect(def.startOffset).toBe(catalogSrc.indexOf(':vec/count'));
  });

  it('falls back to the one verb of a name under a kind when no contract names it', async () => {
    const src = '1 | add 2';
    const { root } = parseDocument(src, 'test.qlang');
    const def = await definitionAtOffset(root, src.indexOf('add'), testCatalogCtx);
    expect(def.startOffset).toBe(catalogSrc.indexOf(':number/add'));
  });

  it('returns null for a verb of the language without a catalog context', async () => {
    const src = '[1 2 3] | count';
    const { root } = parseDocument(src, 'test.qlang');
    const def = await definitionAtOffset(root, src.indexOf('count'));
    expect(def).toBeNull();
  });

  it('a declaration of the document shadows a verb of the language — jumps to the declaration, not the catalog', async () => {
    const src = ':count 42 | count';
    const { root } = parseDocument(src, 'test.qlang');
    const def = await definitionAtOffset(root, src.lastIndexOf('count'), testCatalogCtx);
    expect(def).not.toBeNull();
    expect(def.fileUri).toBeUndefined();
    expect(def.startOffset).toBe(0);
  });

  it('returns null for a part that names no declaration', async () => {
    const src = '42';
    const { root } = parseDocument(src, 'test.qlang');
    expect(await definitionAtOffset(root, 0)).toBeNull();
  });

  it('reads a name by the spelling it was read under: a call reaches the declaration of its name, a label\'s among them, and a tag no declaration by its last name', async () => {
    const src = ':Box |~~ B ~~| | :Box/Inner |~~ I ~~| | Box | get [::Inner ::Box]';
    const { root } = parseDocument(src, 'test.qlang');
    expect((await definitionAtOffset(root, src.indexOf('| Box') + 2)).startOffset).toBe(0);
    expect(await definitionAtOffset(root, src.indexOf('::Inner') + 3)).toBeNull();
    expect((await definitionAtOffset(root, src.lastIndexOf('::Box') + 3)).startOffset).toBe(0);
  });

  it('jumps from a call by address to the declaration of that address alone, a declaration of its last name aside', async () => {
    const src = ':vec/x ~(1) | :string/x ~(2) | :count 5 | [1] | get [~(vec/x) ~(vec/count)]';
    const { root } = parseDocument(src, 'test.qlang');
    expect((await definitionAtOffset(root, src.indexOf('vec/x)'))).startOffset).toBe(0);
    expect(await definitionAtOffset(root, src.indexOf('vec/count'))).toBeNull();
    expect((await definitionAtOffset(root, src.indexOf('vec/count'), testCatalogCtx)).fileUri).toBe('file:///test/core.qlang');
  });

  it('jumps from a call of a verb in its own body to its declaration, by its name and by its address, and a value its own body names to none', async () => {
    const src = ':map/walk ~(get {:n /n :kids ~(get /kids | map ~walk | map ~map/walk)}) | :n (n | add 1)';
    const { root } = parseDocument(src, 'test.qlang');
    for (const offset of [src.indexOf('~walk') + 1, src.indexOf('~map/walk') + 1]) expect((await definitionAtOffset(root, offset)).startOffset).toBe(0);
    expect(await definitionAtOffset(root, src.indexOf('(n') + 1)).toBeNull();
  });

  it('returns null for a text that does not parse', async () => {
    expect(await definitionAtOffset(null, 0)).toBeNull();
  });
});

describe('the references of a name', () => {
  it('finds all occurrences of a verb a reader declares', () => {
    const src = ':number/double ~(mul 2) | [1 2] | map ~double';
    const { root } = parseDocument(src, 'test.qlang');
    const refs = referencesAtOffset(root, src.lastIndexOf('double'));
    expect(refs.length).toBe(2);
  });

  it('finds references from the declaration site', () => {
    const src = ':x 42 | x';
    const { root } = parseDocument(src, 'test.qlang');
    const kwOffset = src.indexOf(':x') + 1;
    const refs = referencesAtOffset(root, kwOffset);
    expect(refs.length).toBe(2);
  });

  it('finds no references from a keyword that is no name of a declaration', () => {
    for (const src of [':x :y | y', '[:y] | y']) {
      const { root } = parseDocument(src, 'test.qlang');
      expect(referencesAtOffset(root, src.indexOf(':y') + 1), src).toEqual([]);
    }
  });

  it('returns references for the verbs of the language', () => {
    const src = '[1 2 3] | count | add 1';
    const { root } = parseDocument(src, 'test.qlang');
    const refs = referencesAtOffset(root, src.indexOf('count'));
    expect(refs.length).toBe(1);
  });

  it('finds the references of a tag from the head of a tagged literal, an error literal among them, each head spanned alone', () => {
    const src = ':E |~~ An E. ~~| | :Box |~~ A box. ~~| | get [::E!{:k 1} ::E ::Box[1] ::Box]';
    const { root } = parseDocument(src, 'test.qlang');
    const written = offset => referencesAtOffset(root, offset).map(({ startOffset, endOffset }) => src.slice(startOffset, endOffset));
    expect(written(src.indexOf('::E!') + 1)).toEqual([':E |~~ An E. ~~|', '::E', '::E']);
    expect(written(src.indexOf('::Box[') + 2)).toEqual([':Box |~~ A box. ~~|', '::Box', '::Box']);
  });

  it('returns empty for a text that does not parse', () => {
    expect(referencesAtOffset(null, 0)).toEqual([]);
  });
});

it('answers goto-definition of a verb of the language with the file of its source the core\'s package exports, wherever the server stands', async () => {
  const outside = mkdtempSync(join(tmpdir(), 'qlang-lsp-'));
  cpSync(join(lspDir, 'src'), join(outside, 'src'), { recursive: true });
  symlinkSync(join(lspDir, '..', 'node_modules'), join(outside, 'node_modules'), 'junction');
  const serverProcess = spawn(process.execPath, [join(outside, 'src', 'server.mjs'), '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    const initialized = answerOf(serverProcess, 1);
    serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { processId: null, rootUri: null, capabilities: {} } }));
    await initialized;
    const uri = 'file:///probe.qlang';
    serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'qlang', version: 1, text: '[1 2] | vec/count' } } }));
    const definition = answerOf(serverProcess, 2);
    serverProcess.stdin.write(framedMessage({ jsonrpc: '2.0', id: 2, method: 'textDocument/definition', params: { textDocument: { uri }, position: { line: 0, character: 10 } } }));
    const { uri: sourceUri } = (await definition).result;
    expect(sourceUri.startsWith(new URL('.', import.meta.resolve('@kaluchi/qlang-core/lib/qlang/vec.qlang')).href) && sourceUri.endsWith('.qlang')).toBe(true);
  } finally {
    if (serverProcess.exitCode === null) await new Promise(resolve => { serverProcess.once('exit', resolve); serverProcess.kill(); });
    rmSync(outside, { recursive: true, force: true, maxRetries: 5 });
  }
}, 30_000);
