import { it, expect } from 'vitest';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { runQuery } from '../../src/run.mjs';
import { renderCellOutcome } from '../../src/render.mjs';
import { captureIoContext } from '../helpers/captured-streams.mjs';

const keptBy = async query => {
  const outcome = await renderCellOutcome(await runQuery(query, captureIoContext()), { didExplicitStdoutEffect: false, shouldColorize: false });
  return outcome.stdoutText.match(/::cell"([0-9a-f]{12})"/);
};

const answerOf = async query => (await runQuery(query, captureIoContext())).result;

const folderOf = identity => readdirSync(join(tmpdir(), 'qlang')).map(root => join(tmpdir(), 'qlang', root, 'cells', identity)).find(existsSync);

it('names the cell in the refusal it prints, and answer reads the whole back in a later query', async () => {
  const [cell] = await keptBy('3000 | range | map ~(get {:id ~(it) :name "user"})');
  expect(await answerOf(`${cell} | answer | get [~(count) ~(last | get /id)]`)).toEqual([3000, 2999]);
});

it('keeps the query, the values it declared and the answer under the identity of its root', async () => {
  const [, identity] = await keptBy(':k 7 | 5000 | range');
  const folder = folderOf(identity);
  expect(['source.qlang', 'names.qlang', 'answer.qlang'].map(name => readFileSync(join(folder, name), 'utf8').slice(0, 10))).toEqual([':k 7 | 500', ':k 7', '[0 1 2 3 4']);
});

it('reads a value of a kind the query declared by its names where the reading query declares the kind again, and by payload in any', async () => {
  const box = ':Box |~~ B ~~| (::kind | wires :w |~~ w ~~| /w ::number)';
  const [cell] = await keptBy(`${box} | 3000 | range | map ~(get {:w ~(it)} | tag ::Box)`);
  expect(await answerOf(`${box} | ${cell} | answer | last | w`)).toBe(2999);
  expect(await answerOf(`${cell} | answer | last | payload`)).toEqual(new Map([['w', 2999]]));
});

it('takes away a cell older than a day as it keeps another, and passes by an entry that names no folder', async () => {
  const [, identity] = await keptBy('5000 | range');
  const cells = dirname(folderOf(identity));
  const aged = join(cells, 'agedagedaged');
  mkdirSync(aged);
  const twoDaysAgo = (Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000;
  utimesSync(aged, twoDaysAgo, twoDaysAgo);
  const vanished = join(cells, 'vanishedvani');
  symlinkSync(join(cells, 'nowherenowhe'), vanished, 'junction');
  try {
    await keptBy('5000 | range');
    expect([existsSync(aged), lstatSync(vanished).isSymbolicLink()]).toEqual([false, true]);
  } finally {
    rmSync(vanished, { force: true });
  }
});

it('keeps one value under one cell, named by the hash of what it keeps', async () => {
  const [first] = await keptBy('4000 | range');
  const [second] = await keptBy('4000 | range');
  const [other] = await keptBy('4001 | range');
  expect([first === second, first === other]).toEqual([true, false]);
});

it('refuses a cell it does not hold', async () => {
  expect((await answerOf('::cell"000000000000" | answer !| tag')).name).toBe('cell/answer/NotHeldError');
});
