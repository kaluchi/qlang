// A clean child [D142]: `claude -p` started from a directory of its own,
// with no settings, no memory, no MCP server and a one-line system
// prompt, so its context is the prompt it is handed and nothing the
// session that runs it knows. A blind child has no tool and answers in
// one reply; a child of the command line runs `qlang` alone, on the
// input files copied beside it, and its record keeps every call it made
// and what the language answered, the frictions a reading of the run
// looks for.

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const SYSTEM_PROMPT = 'You are a careful assistant.';
const COMMAND_LINE_TOOLS = ['Bash(qlang:*)', 'Bash(MSYS_NO_PATHCONV=1 qlang:*)', 'Bash(cat:*)', 'Bash(head:*)'];

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

// runChild({ prompt, model, mode, workDir }) → the record of the run;
// `mode` is `blind` or `cli`, and `workDir` the directory the child
// starts in, which holds the input files for `cli`.
export function runChild({ prompt, model, mode, workDir }) {
  mkdirSync(workDir, { recursive: true });
  const toolFlags = mode === 'cli'
    ? ['--tools', 'Bash', '--allowedTools', ...COMMAND_LINE_TOOLS]
    : ['--tools', ''];
  const flags = ['-p', '--model', model, ...toolFlags, '--strict-mcp-config', '--restricted',
    '--system-prompt', SYSTEM_PROMPT, '--output-format', 'stream-json', '--verbose'];
  return new Promise(resolve => {
    const child = spawn('claude', flags, { cwd: workDir });
    let streamText = '';
    child.stdout.on('data', chunk => { streamText += chunk; });
    child.on('close', () => resolve(recordOfStream(streamText)));
    child.stdin.end(prompt);
  });
}
