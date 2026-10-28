import { it, expect } from 'vitest';
import { runCli } from '../../helpers/run-cli.mjs';

it('reads piped JSON as values, which `get /name` reads', async () => {
  const { stdout, exitCode } = await runCli(['get /name'], {
    stdin: '{"name": "alice", "age": 30}'
  });
  expect(exitCode).toBe(0);
  expect(stdout.trim()).toBe('alice');
});

it('reads piped JSON as the text it is under a query headed by `in`', async () => {
  const { stdout, exitCode } = await runCli(['::stdio | in | append " world"'], {
    stdin: '{"name": "alice"}'
  });
  expect(exitCode).toBe(0);
  expect(stdout.trim()).toBe('{"name": "alice"} world');
});
