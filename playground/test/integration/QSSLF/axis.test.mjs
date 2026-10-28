import { it, expect } from 'vitest';
import { runCli } from '../../helpers/run-cli.mjs';

it('the axes read a declaration of the query in script mode', async () => {
  const { stdout, exitCode } = await runCli(
    [':foo |~~ note ~~| | ::foo | doc | content'],
    { stdin: '' });
  expect(exitCode).toBe(0);
  expect(stdout.trim()).toBe('note');
});
