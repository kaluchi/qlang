import { describe, it, expect } from 'vitest';
import { runCli } from '../../helpers/run-cli.mjs';

describe('CLI: piped stdin — the readings of stdin', () => {
  it('reads piped JSON as values, which `get /name` reads', async () => {
    const { stdout, exitCode } = await runCli(['get /name'], {
      stdin: '{"name": "alice", "age": 30}'
    });
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('alice');
  });

  it('--raw reads standard input as a string', async () => {
    const { stdout, exitCode } = await runCli(['--raw', 'append " world"'], {
      stdin: 'hello'
    });
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('hello world');
  });
});
