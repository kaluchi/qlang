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
// failure it printed, or a value.
function answerKindOf(toolResultText) {
  const failure = /::(\w+)!\{/.exec(toolResultText);
  if (failure !== null) return failure[1];
  if (/permission|requires approval/i.test(toolResultText)) return 'denied';
  return 'value';
}

function textOfToolResult(content) {
  if (typeof content === 'string') return content;
  return (content ?? []).map(part => part.text ?? '').join('');
}

// The record of a run from the events the child streamed: its final
// reply, its turns and tokens, and the calls of the command line in
// their order.
function recordOfStream(streamText) {
  const calls = [];
  const pendingById = new Map();
  let final = null;
  for (const line of streamText.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let streamEvent;
    try { streamEvent = JSON.parse(line); } catch { continue; }
    if (streamEvent.type === 'result') final = streamEvent;
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
    result: final?.result ?? null,
    failed: final === null || final.is_error === true,
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
