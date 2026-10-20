// A clean child [QSWRK#measure]: `claude -p` started from a directory of its own,
// with no settings, no memory, no MCP server and a one-line system
// prompt, so its context is the prompt it is handed and nothing the
// session that runs it knows. It runs `qlang` alone, on the data files
// copied beside it [QSWRK#measure], and its record keeps every call it made and
// what the language answered, the frictions a reading of the run looks
// for.

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const SYSTEM_PROMPT = 'You are a careful assistant.';
const COMMAND_LINE_TOOLS = ['Bash(qlang:*)', 'Bash(MSYS_NO_PATHCONV=1 qlang:*)', 'Bash(cat:*)', 'Bash(head:*)'];

// The environment a child runs in beside the session's [QSHST#shell]: Git Bash
// rewrites an argument that begins with `/` into a path of Windows, which
// mangles a query that reads a part, and the conversion is off.
export const CHILD_ENVIRONMENT = Object.freeze({ MSYS_NO_PATHCONV: '1' });

// The environment with the command line of a tree first on the PATH as
// `qlang`, so a reader of a worktree runs the language of the tree it reads
// [QSWRK#review].
export function withTheLanguageOf(repoRoot, env) {
  const commands = mkdtempSync(join(tmpdir(), 'qlang-of-the-tree-'));
  const commandLine = join(repoRoot, 'cli', 'src', 'bin.mjs');
  const forTheShell = commandLine.split('\\').join('/');
  writeFileSync(join(commands, 'qlang'), ['#!/bin/sh', `exec node "${forTheShell}" "$@"`, ''].join('\n'), { mode: 0o755 });
  writeFileSync(join(commands, 'qlang.cmd'), `@node "${commandLine}" %*\r\n`);
  const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH') ?? 'PATH';
  return { ...env, [pathKey]: `${commands}${delimiter}${env[pathKey] ?? ''}` };
}

// What a tool result of the command line answered: the tag of the
// first failure it printed, as the language prints it or under JSON, or
// a value.
function answerKindOf(toolResultText) {
  const failure = /::([\w/@.-]+)!\{|"\$error": \{\s*"\$tag": "([^"]+)"/.exec(toolResultText);
  if (failure !== null) return failure[1] ?? failure[2];
  if (/permission|requires approval/i.test(toolResultText)) return 'denied';
  return 'value';
}

function textOfToolResult(content) {
  if (typeof content === 'string') return content;
  return (content ?? []).map(part => part.text ?? '').join('');
}

// The reply the command line writes in place of an answer at the limit of
// its use, `You've hit your session limit · resets …`.
const LIMIT_REPLY = /^You've hit your .*limit/;

// The record of a run from the events the child streamed: the model
// that answered, which an alias such as `haiku` names only until the
// command line maps it anew, its final reply, its calls to the model,
// one per answer it streamed whatever tools the answer called, its turns
// and tokens, and the calls of the command line in their order.
function recordOfStream(streamText) {
  const calls = [];
  const pendingById = new Map();
  const answers = new Set();
  let modelId = null;
  let final = null;
  for (const line of streamText.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let streamEvent;
    try { streamEvent = JSON.parse(line); } catch { continue; }
    if (streamEvent.type === 'system' && streamEvent.subtype === 'init') modelId = streamEvent.model ?? null;
    if (streamEvent.type === 'result') final = streamEvent;
    if (streamEvent.type === 'assistant' && streamEvent.message?.id) answers.add(streamEvent.message.id);
    const parts = Array.isArray(streamEvent.message?.content) ? streamEvent.message.content : [];
    for (const part of parts) {
      if (part.type === 'tool_use') {
        const call = { command: String(part.input?.command ?? '').slice(0, 600), answered: null, head: '' };
        pendingById.set(part.id, call);
        calls.push(call);
      } else if (part.type === 'tool_result' && pendingById.has(part.tool_use_id)) {
        const call = pendingById.get(part.tool_use_id);
        const resultText = textOfToolResult(part.content);
        call.answered = answerKindOf(resultText);
        call.head = resultText.replace(/\s+/g, ' ').slice(0, 240);
      }
    }
  }
  return {
    modelId,
    result: final?.result ?? null,
    failed: final === null || final.is_error === true || LIMIT_REPLY.test(final.result ?? ''),
    requests: answers.size,
    turns: final?.num_turns ?? null,
    inputTokens: final?.usage ? final.usage.input_tokens + (final.usage.cache_read_input_tokens ?? 0) + (final.usage.cache_creation_input_tokens ?? 0) : null,
    outputTokens: final?.usage?.output_tokens ?? null,
    calls
  };
}

// runChild({ prompt, model, workDir }) → the record of the run;
// `workDir` the directory the child starts in, which holds the data
// files.
export function runChild({ prompt, model, workDir }) {
  mkdirSync(workDir, { recursive: true });
  const flags = ['-p', '--model', model, '--tools', 'Bash', '--allowedTools', ...COMMAND_LINE_TOOLS, '--strict-mcp-config', '--restricted',
    '--system-prompt', SYSTEM_PROMPT, '--output-format', 'stream-json', '--verbose'];
  return new Promise(resolve => {
    const child = spawn('claude', flags, { cwd: workDir, env: { ...process.env, ...CHILD_ENVIRONMENT } });
    let streamText = '';
    child.stdout.on('data', chunk => { streamText += chunk; });
    child.on('close', () => resolve(recordOfStream(streamText)));
    child.stdin.end(prompt);
  });
}
