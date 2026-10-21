import { describe, it, expect } from 'vitest';
import { runCli } from '../../helpers/run-cli.mjs';

describe('CLI: script mode — query argument', () => {
  it('the axes read a declaration of the query in script mode', async () => {
    const { stdout, exitCode } = await runCli(
      [':foo |~~ note ~~| | ::foo | doc | content'],
      { stdin: '' });
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('note');
  });
});
