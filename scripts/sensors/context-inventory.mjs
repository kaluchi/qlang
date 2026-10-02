// What reached the window of a session besides the conversation: the
// system prompt and every text the harness attached, by its kind, beside
// the conversation itself, for the session and for each subagent it
// spawned. The harness attaches the instruction files with the index of
// the memory (`instructions`), the git status (`session_context`), what a
// hook added, the listings of skills, tools and agents, the notices of
// files changed on disk and the reminders of a turn, and every
// attachment keeps the text the model saw in `rendered`; the system
// prompt rides a `prompt_snapshot`, and a message typed while the model
// works arrives as a `queued_command`. The counts run over the whole
// transcript, a compaction's summary among its texts. Runs in a session
// on the maintainer's machine, since it reads the transcripts.
//
// Usage: node scripts/sensors/context-inventory.mjs [session] [--start] [--show kind]
// A session is its id, a prefix of the id, or the path of a transcript,
// the running session without one. `--start` lists in order what arrived
// before the model's first answer; `--show kind` prints every text of
// one kind, `system-prompt` among them.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { recordsOf, sessionTranscript, transcriptFiles } from './transcripts.mjs';

const SYSTEM_PROMPT_KIND = 'system-prompt';
const commandArguments = process.argv.slice(2);
const startOnly = commandArguments.includes('--start');
const shownKind = commandArguments.includes('--show') ? commandArguments[commandArguments.indexOf('--show') + 1] : null;
const sessionName = commandArguments.find(argument => !argument.startsWith('--') && argument !== shownKind);

// The transcript a session names: a path, an id, or the one id a prefix
// begins.
function transcriptOfSession(name) {
  if (name === undefined) return sessionTranscript();
  if (name.endsWith('.jsonl')) return name;
  const matching = transcriptFiles().filter(path => basename(path).startsWith(name));
  if (matching.length !== 1) throw new Error(`${matching.length} transcripts begin with ${name}`);
  return matching[0];
}

// The transcripts of the subagents a session spawned, each titled by the
// type, the model and the description its spawn named.
function subagentsOf(transcriptPath) {
  const subagentDir = join(dirname(transcriptPath), basename(transcriptPath, '.jsonl'), 'subagents');
  if (!existsSync(subagentDir)) return [];
  return readdirSync(subagentDir).filter(name => name.endsWith('.jsonl')).sort().map(name => {
    const metaPath = join(subagentDir, name.replace(/\.jsonl$/, '.meta.json'));
    const spawn = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
    return { path: join(subagentDir, name), title: `subagent ${spawn.agentType ?? ''} ${spawn.model ?? ''} «${spawn.description ?? name}»` };
  });
}

// The text of a message's content: a string, or its parts joined.
function textOfContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(part => part.text ?? (typeof part.content === 'string' ? part.content : JSON.stringify(part.content ?? ''))).join('\n');
}

// A text the user turn carries in markup, a command's output or a
// notification, came from the harness; any other is typed.
const userTextEntry = (text, at) => text.startsWith('<')
  ? { kind: 'markup in a user turn', text, at, conversation: false }
  : { kind: 'typed', text, at, conversation: true };

// Each text a record put into the window, with the channel it came by
// and whether it belongs to the conversation.
function* entriesOf(record) {
  const at = record.timestamp ?? '';
  if (record.type === 'attachment') {
    const attachment = record.attachment ?? {};
    if (attachment.type === 'prompt_snapshot') {
      yield { kind: SYSTEM_PROMPT_KIND, text: [attachment.systemPrompt ?? []].flat().join('\n'), at, conversation: false };
      return;
    }
    const rendered = (record.rendered ?? []).map(part => part.content ?? '').join('\n');
    if (rendered !== '') yield { kind: attachment.type, text: rendered, at, conversation: false };
    return;
  }
  const content = record.message?.content;
  if (record.type === 'user') {
    if (record.isCompactSummary) {
      yield { kind: 'compaction summary', text: textOfContent(content), at, conversation: true };
      return;
    }
    if (typeof content === 'string') {
      yield userTextEntry(content, at);
      return;
    }
    for (const part of content ?? []) {
      if (part.type === 'tool_result') yield { kind: 'tool results', text: textOfContent(part.content), at, conversation: true };
      else if (part.type === 'text') yield userTextEntry(part.text, at);
    }
    return;
  }
  if (record.type !== 'assistant') return;
  for (const part of content ?? []) {
    if (part.type === 'text') yield { kind: 'model text', text: part.text, at, conversation: true };
    else if (part.type === 'thinking') yield { kind: 'model thinking', text: part.thinking ?? '', at, conversation: true };
    else if (part.type === 'tool_use') yield { kind: 'model tool calls', text: JSON.stringify(part.input ?? {}), at, conversation: true };
  }
}

const grouped = count => count.toLocaleString('en-US');
const timeOf = at => at.slice(11, 19);

// The first line of a text that says something, past the tag a reminder
// opens with.
const leadOf = text => (text.split('\n').find(line => line.trim() !== '' && !/^<\/?system-reminder>$/.test(line.trim())) ?? '').trim().slice(0, 100);

// The channels of one transcript, the system prompt counted once at the
// size of its last snapshot, since the window holds one.
function printInventory({ path, title }) {
  const channels = new Map();
  for (const record of recordsOf(path)) {
    for (const entry of entriesOf(record)) {
      const channel = channels.get(entry.kind) ?? { count: 0, characters: 0, firstAt: entry.at, conversation: entry.conversation, lastSize: 0 };
      channel.count++;
      channel.characters += entry.text.length;
      channel.lastSize = entry.text.length;
      channels.set(entry.kind, channel);
    }
  }
  console.log(`${title}\n  ${path}`);
  for (const conversation of [false, true]) {
    console.log(conversation ? '  conversation' : '  harness');
    const rows = [...channels].filter(([, channel]) => channel.conversation === conversation)
      .map(([kind, channel]) => [kind, channel.count, kind === SYSTEM_PROMPT_KIND ? channel.lastSize : channel.characters, channel.firstAt])
      .sort((one, other) => other[2] - one[2]);
    for (const [kind, count, characters, firstAt] of rows) {
      console.log(`    ${kind.padEnd(28)} ${String(count).padStart(6)} × ${grouped(characters).padStart(11)} chars   first ${timeOf(firstAt)}`);
    }
  }
}

// What arrived before the model's first answer, in order.
function printStart({ path, title }) {
  console.log(title);
  for (const record of recordsOf(path)) {
    if (record.type === 'assistant') break;
    for (const entry of entriesOf(record)) {
      console.log(`  ${timeOf(entry.at)} ${entry.kind.padEnd(24)} ${grouped(entry.text.length).padStart(9)}  ${leadOf(entry.text)}`);
    }
  }
}

// Every text of one kind, under the transcript and the time it came at;
// of the system prompt the last snapshot.
function printKind({ path, title }, kind) {
  const texts = [];
  for (const record of recordsOf(path)) for (const entry of entriesOf(record)) if (entry.kind === kind) texts.push(entry);
  for (const entry of kind === SYSTEM_PROMPT_KIND ? texts.slice(-1) : texts) {
    console.log(`── ${title} ${timeOf(entry.at)}\n${entry.text}\n`);
  }
}

const mainTranscript = transcriptOfSession(sessionName);
const transcripts = [{ path: mainTranscript, title: `session ${basename(mainTranscript, '.jsonl')}` }, ...subagentsOf(mainTranscript)];
for (const transcript of transcripts) {
  if (shownKind !== null) printKind(transcript, shownKind);
  else if (startOnly) printStart(transcript);
  else printInventory(transcript);
}
