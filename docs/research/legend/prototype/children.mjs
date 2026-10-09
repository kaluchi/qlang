// Clean children against the prototype's command line: each starts from a
// directory of its own with no settings, memory or MCP server, and finds
// `qlang` first on its PATH as the prototype, with the legend on or off.
// Usage: node proto/children.mjs <model> <runs>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const shimDir = join(here, 'shim');
mkdirSync(shimDir, { recursive: true });
const shim = join(shimDir, 'qlang');
writeFileSync(shim, `#!/usr/bin/env bash\nexec node "${join(here, 'q.mjs').split('\\').join('/')}" "$@"\n`);
chmodSync(shim, 0o755);

const PROMPT = `A CI tool answered with a value of the qlang language, and the tool bound it under the name run. You have the command line qlang: qlang 'run' prints it, and any query starts from it, qlang 'run | …'. You know nothing of qlang yet: qlang '::qlang | doc' prints the first page of the language, and x | doc explains any value x.

Answer each question on its own line as "Qn: answer — the query that answered it", nothing else:
Q1: Did this run pass?
Q2: Which stage failed?
Q3: Which stages did not run?
Q4: Which stage took longest, and how many seconds?
Q5: Who gets paged because of this run?
Q6: Write the query that runs the failed stage again (do not run it).
Q7: Which tests needed more than three attempts?`;

function recordOf(streamText) {
  let final = null;
  const calls = [];
  for (const line of streamText.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'result') final = event;
    for (const part of Array.isArray(event.message?.content) ? event.message.content : []) {
      if (part.type === 'tool_use') calls.push(String(part.input?.command ?? '').slice(0, 300));
    }
  }
  const usage = final?.usage;
  return {
    result: final?.result ?? null, turns: final?.num_turns ?? null, calls,
    inputTokens: usage ? usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) : null
  };
}

function runChild({ model, arm, index }) {
  const workDir = join(tmpdir(), 'qlang-legend-children', `${model}-${arm}-${index}`);
  mkdirSync(workDir, { recursive: true });
  const flags = ['-p', '--model', model, '--tools', 'Bash', '--allowedTools', 'Bash(qlang:*)', '--strict-mcp-config', '--restricted',
    '--system-prompt', 'You are a careful assistant.', '--output-format', 'stream-json', '--verbose'];
  const pathKey = Object.keys(process.env).find(key => key.toUpperCase() === 'PATH');
  const env = { ...process.env, [pathKey]: `${shimDir};${process.env[pathKey]}`, QLANG_LEGEND: arm === 'legend' ? 'on' : 'off' };
  return new Promise(resolve => {
    const child = spawn('claude', flags, { cwd: workDir, env, shell: true });
    let streamText = '';
    child.stdout.on('data', chunk => { streamText += chunk; });
    child.on('close', () => resolve({ model, arm, index, ...recordOf(streamText) }));
    child.stdin.end(PROMPT);
  });
}

const [model = 'sonnet', runs = '1'] = process.argv.slice(2);
const jobs = [];
for (let index = 0; index < Number(runs); index++) {
  for (const arm of ['legend', 'page']) jobs.push(runChild({ model, arm, index }));
}
const records = await Promise.all(jobs);
writeFileSync(join(here, `children-${model}.json`), JSON.stringify(records, null, 1));
for (const record of records) {
  console.log(`=== ${record.model} ${record.arm} #${record.index}: ${record.calls.length} calls, ${record.turns} turns, ${record.inputTokens} tokens in`);
  console.log(record.result);
  console.log('calls:', record.calls.map(call => call.replace(/\s+/g, ' ').slice(0, 110)).join('\n       '));
}
