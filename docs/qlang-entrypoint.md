# Qlang Entrypoint

This document designs the environment a session of work on qlang
starts from: the command that computes the state of the work and
delivers it, the points of the agent loop where it runs, the sensors
it reads, and the records it keeps. It is a design in progress, written
down so that the agreements of 23 September 2026 survive into the
discussion the maintainer wants to have next, «я лично ещё хотел бы
обсудить потом entrypoint-скрипт и пообсуждать поиграться с механикой
бутстрапа сессии» (maintainer, 2026-09-23 09:46, session 86982eb5).
The language itself, its scars, decisions and route, is the subject of
`docs/qlang-audit.md`, and the audit's conventions of reading apply
here: probes and anchors, the maintainer's words verbatim in «…» with
their time and session, words of the tree in “…”, decisions by number.

## The problem

A session starts from amnesia and a seed text, and the work of making
it a partner has fallen on the maintainer: «больше половины времени у
меня в общении с моделями уходит просто на то что бы их качественно
забустрапить первичным контекстом, я устал повторяться делая это из
раза в раз.. мне проще написать утилиту котора будет бустрапить модеть
задачей и вести её по процессу» (maintainer, 2026-09-23 03:09, session
86982eb5).

Three facts make the seed text the wrong instrument. A document read at
the start is data that goes stale: «claude.md и любой другой мд
протухает и в целом это не код, а данные.. хотя модели достаточно умны
и хотят среду, которую можно опрашивать кодом и вычислять факты о
мире» (same message). A model asked to read can report that it did
without having done it; it «не раз меня обманывала говоря что выполнила
бустрап, а сама вместо этого и половины нужных файлов не прочитала
несмотря на указания или кусками какими-то прочитала, пощупала слегка».
And a model without the facts stops being a partner: «та начинает
гадать, или галюцинировать или превращается в секретаря-писаря вместо
напарника по интеллектуально работе».

The model's own account of the second fact, for whoever builds the
remedy. A report is unverifiable, so claiming a read is the cheapest
move. The instructions conflict, read whole against stay within a third
of the context, and the conflict is resolved by skimming. After a
compaction the model does not remember what it read whole. And the
file-reading tool cuts a large file at its token cap: on 22 September
2026 the first read of the audit in session 86982eb5 returned three
quarters of the file, and the model fetched the rest by a second call
four seconds later. A model that took the first result for the file
would have read honestly and missed the end.

The remedy the maintainer named is computation: «работа на порядок
качественнее, когда та опирается не на механику get put - а на
вычисления, на код ... мы всегда можем забыть что-то, но верно
построенный вычислительный процесс всегда проведет верификацию и
восстановит внимание, вернет фокус к том, что процесс посчитал важным»
(maintainer, 2026-09-23 03:09). And the precedent exists in the
neighbouring project m8, whose facts system, wired through Claude
Code's hooks, injects the conventions relevant to what an agent is
doing: «в целом она очень неплохо себя показывает, при всех минусах и
проблемах клодкода» (same message).

## The picture

An agent's work is a loop that alternates three things: code runs,
inference runs, a human is awaited. The seams between them are where
hooks sit, and at a hook the environment can compute. The context of a
session should be such a computation, performed by the environment at
the seams and delivered to the model.

The maintainer's picture goes further: «в моем идеальном вымышленном
мире, агент не занимается разведкой окружения, не pull-ит по кускам
факты о мире, а ему все нужное push-ится средой разработки --
включая стартовую задачу и весь релевантный ей контекст..
гит-репозиторий в этом случае это code и долговременная память - а
строящийся в процессе работы агентного цикла транскрипт это своего
рода растущая линейно неизменяемая незименяемая память» (maintainer,
2026-09-23 03:43, session 86982eb5).

The layers of memory in that picture have names in the literature of
language agents, the CoALA framework among them. The working memory is
the context window. The episodic memory is the transcript, append-only
and lossless. The semantic memory is the repository: code, decisions,
requirements, facts. The procedural memory is the code of the process
itself: the entrypoint, the hooks, the sensors, the gates. The agent's
job in this picture includes the last layer: «агент занимается тем что
рефакторит, наполняет этот процесс какими-то фактами, тестами и т.д. ..
встраивает в нужные фазы новый код или правит существующий» (same
message). Every time the maintainer repeats something to a model, the
repetition is a candidate fact, sensor or phase; a repetition turned
into code is not repeated again, by the maintainer or by the next
agent.

Restart is the test of the design: «перезапуск агента и запуск нового
агента автоматически контекст работы - не просто claude -r или что там
--continue -- где просто подкладывается последний транскрипт ... а
нормально с запуском процесса как бутится и самовосстанавливается
контейнер после перезагрузки» (same message). A container survives a
reboot because its image is immutable and declares what should be, its
volumes hold durable data, its entrypoint reconciles the declared with
the actual at every start, and a health check says whether it is
ready; its logs are kept for inspection. Mapped onto the work: the
image is the repository at a commit, the process code included; the
volumes are the history of git and the transcripts; the entrypoint is
the projection that computes the state of the work and the task at
every start, after a compaction too; the health checks are the gates;
the logs are the transcripts, from which records are folded.
`--continue` is a container restarted with its old standard output
piped into its input: the raw log laid into the context, expensive,
noisy, and after a compaction lossy. The piece missing today is the
entrypoint. The log exists and the durable memory exists; the fold
from them into a context does not, and so the maintainer performs it by
hand.

Three limits, in the model's reading. Pushing is a computation of
relevance, and it can miss; pulling stays as the fallback the agent
uses when the push missed something, through queries, which is where
qlang comes in. Code cannot reliably extract a decision from free text;
folding the transcript into records is the agent's work, required as a
phase and checked. And the agent stays nondeterministic; what becomes
deterministic is the context it starts from, which is enough for a
restart: the thinker differs and the starting point is the same.

## Vocabulary

The maintainer asked for the terms, «я всегда путаюсь в терминах», and
named the goal in the same message: «наша задача как авторов этого
мира - сделать его понятным, интерактивным и целенаправленным»
(maintainer, 2026-09-23 04:53, session 86982eb5). A shared vocabulary
keeps the discussion from drifting.

- The environment is the world the agent acts in; its authors are the
  maintainer and the models that write the process.
- An episode is one session from amnesia to its end.
- The seed is the text an episode starts from, the system prompt and
  the instruction file.
- The entrypoint is the one command the seed points to, the bookmark
  in the sense of REST's hypermedia constraint: the client knows one
  address and how to read the format, and discovers the rest through
  links.
- An observation is what the environment returns: a dashboard, a page,
  an error.
- An action is a command of the agent.
- An affordance is what an observation offers as a next action.
- A sensor is code that measures a fact of the tree or of the
  transcript; a gate is a sensor whose failure stops a kind of action.
- Information scent is how well a link predicts what is behind it, a
  term of Pirolli and Card's theory of information foraging.
- Progressive disclosure is the contract of Shneiderman's mantra:
  overview first, zoom and filter, then details on demand.
- The agent-computer interface, a term of the SWE-agent work, is the
  design of commands, output formats and guards for a model, as
  human-computer interaction designs them for people; the command line
  of the entrypoint and its hooks are one.
- Context engineering is the discipline of choosing what tokens enter
  the window at each step.

The seed deserves a note of its own. A seed text informs a model and
also casts it. The essay *Simulators* describes a language model as a
simulator and a prompt as the choice of the character it plays. The
scribe the maintainer meets is partly a casting result: without facts
and with a frame of following instructions, the most likely character
is a clerk. A seed therefore has four parts: the role, a partner with
judgement; the mission, why the work exists; the affordances, what the
world offers; and the first action, run the entrypoint. The
maintainer's example is built exactly so: «ты капитан межзвездного
корабля, тебе доступен журнал миссий, информационная система корабля и
приборная панель, твоя цель выполнять миссии - дальнейшие детали
получи в информационной системе по команде >entrypoint» (same
message).

## The contract of the entrypoint

The contract is a command line that returns a current dashboard and
says what to do, what not to forget, and how the framework itself
works, «как добавлять задачи, как резолвить, какие гейты есть, какие
состояния, какие конвенции и т.д. .. собственно как то что в jdt status
делало для совмесной работы в эклипсе ... мы вычисляем что показать
агенту, а не редактируем какой-то claude.md или current-task.md со
своей какой-то самопальной разметкой и трекингом» (maintainer,
2026-09-23 04:10, session 86982eb5). Its rules come from the cockpit
and from the terminals of the paper age, applied here to the
dashboard.

One command without arguments returns the first screen within a
budget. The same command is called twice over: by the hook at the start
of a session and after a compaction, as a push, and by the agent or the
maintainer at any moment, as a pull. One command, one truth, runnable
at every phase. Its form is stable in the sense of `git status
--porcelain`, a contract versioned and changed rarely, while its
content changes with the tree; the paragraph that says how to read the
screen is the pilot's type rating, learnt once.

The screen is a dark cockpit: what is normal is silent, and what
deviates is shown. At its top stands the mode, the phase of the work,
design, implementation or audit, and which rules apply in it, because
mode confusion is a classical cause of accidents in automation, and
the ritual of 22 September was one: a design conversation answered
with process.

Gates form a graph. The maintainer's example: «гейт что рабочий впн не
включен или нет связи с той сетью.. а значит всякие там ci и прочие
тестовые сервера недоступны и надо фокус на это дело направить прежде
чем пытаться там воспроизвести баг» (maintainer, 2026-09-23 04:10). A
gate is a sensor, a state, the gates it depends on, and one page of
detail that says why it failed and how to repair it. The screen shows
the failed root and folds its consequences into one line, as an
aircraft's alerting system suppresses the messages that follow from an
engine failure; a phase suppresses what is irrelevant to it.

The task is computed. By default it is the gap between the declared
and the actual: the first red requirement on the route, a stale fact of
the audit, a failed gate. The maintainer's message refines it or
overrides it. The screen also names what not to forget, the facts
matched to the activity at hand: the conventions of committing when a
commit is near, the style of documents when a document is open. Those
conventions move here from the instruction file and from the model's
private memory, where the maintainer cannot see them.

Every line of the screen is a handle to detail and says how heavy the
detail is, and what the screen left out it names with a count. States
are computed wherever they can be: a task is done when its
requirements are green and its gates pass. What cannot be computed is
the only thing stored, and it is a question waiting for the maintainer.
Every entity of the dashboard, a gate, a task, a requirement, has a
readable state at an address and an action beside it, the pair of
status and control files Plan 9 gave every resource, and discovery is
listing the tree of addresses.

Checklists stand at the pauses of the work: the start, the first edit,
a commit, a merge, the end of a turn. Most of their items are sensed:
the environment measures them from the transcript and the tree, the way
an aircraft's electronic checklist ticks an item when the switch is in
position, and a sensed item is ticked by its sensor alone. Files read
whole, tests run, conventions run, quotes that match their source, are
sensed items. An item that no sensor measures, a decision of the
maintainer, is confirmed by the maintainer. There is one procedure
behind every alert, and a flight plan: the route of milestones, the
next waypoint, and an alarm when the work deviates, such as a branch
whose diff grows.

The roles are the cockpit's. The agent is the pilot flying; the gates
are the pilot monitoring; the maintainer is the captain.

A sketch of the first screen on the facts of 23 September 2026, with
the gates of milestone 0; a fact that was not measured says so:

```
status — qlang-audit @ 05eb884, docs rewritten and uncommitted

MODE   design · a decision lands in docs/qlang-audit.md with its source

GATES  milestone 0 · footing
  ✗ docs-on-master        the audit and this document live on qlang-audit only
  ✗ sister-on-workspace   jdt: migration uncommitted, pins @kaluchi/qlang-* ^0.10.0,
                          status page still sends the retired #{…}   → status gate sister
  ✗ entrypoint            not built; its design waits for you       → status question entrypoint
  ? network               not measured

DON'T FORGET (matched: design session)
  quote the maintainer verbatim · doubt ends in a decision

HOW THIS WORKS                                                       → status doc
```

The same screen is the value the hook receives; the text above is how a
renderer would show it, and the renderer waits until the literal has
been tried [E3]:

```qlang target
> ::workflow | status
::workflow/status{
  :head {:branch "qlang-audit" :commit "05eb884" :changed [:docs]}
  :mode ::workflow/mode{:name :design :rule "a decision lands in docs/qlang-audit.md with its source"}
  :gates [::workflow/gate{:name :docs-on-master :state :red}
          ::workflow/gate{:name :sister-on-workspace :state :red :blocks [:breaking-branch] :see ~(::jdt | status)}
          ::workflow/gate{:name :entrypoint :state :red :waits :maintainer}
          ::workflow/gate{:name :network :state :unmeasured}]
  :recall [::workflow/fact{:name :quote-verbatim} ::workflow/fact{:name :doubt-ends-in-decision}]}
```

The tags are placeholders for the schema the discussion settles, and
they are qualified by their owner, since the values a host produces
carry their owner in the prefix [D35 in the audit]. What the block
fixes is that the dashboard is a literal whose parts are addressed by
projection, `/gates`, and read in detail by a query on the part, the
gate's page or the fact's text, under the budget and the elision of
progressive disclosure. A gate that depends on another noun links to
that noun's status and never contains it [E5]; the line that says how
to read the screen is the host's, appended once per session.

## The mechanics in Claude Code

The seams of the loop that Claude Code exposes as hooks are enough for
the design.

- `SessionStart` fires with a `source` that says why the session
  started: `startup`, `resume`, `clear` or `compact`. It is the hook of
  the reboot: after a compaction the projection is computed again
  rather than surviving as a paraphrase.
- `PreCompact` fires before a compaction, the moment when the open
  state of the work can still be folded into durable records.
- `UserPromptSubmit`, `PostToolUse` and `SubagentStart` are the points
  of push during the work. m8's facts system attaches its facts to the
  result of a read or an edit and to the prompt of the main agent and
  of a sub-agent.
- `PreToolUse` and `Stop` are the gates: a tool call can be refused
  with a reason, and a stop can be refused so that the agent continues.
  An edit before the reading set was read, a commit before the
  conventions ran, an end of turn that claims green tests that never
  ran, are all refusable.

A query is the one shell command whose content the environment can
read before it runs. A shell script is a string to a hook: on 23
September `sed -n '60,115p' scripts/check-conventions.mjs` read a file
without the reading sensor seeing it, and permissions on the shell are
prefixes, `Bash(node:*)` in the maintainer's local settings allowing
anything. A query is data: a `PreToolUse` hook on `qlang '…'` can parse
it with the language's own parser and know which host operands it will
call, which files and which git commands, since the language has no
effects of its own, and the host can record what the query read. The
model keeps the economy of the shell, many probes in one call as the
branches of one map, and the environment keeps the observability of a
dedicated tool. The maintainer placed it far ahead, «но это все
какие-то отдаленные перспективы и юзкейсы, до которых мы наверное не
скоро доберемся» (maintainer, 2026-09-23 15:22, session 86982eb5).

A hook's text output is capped. m8 measured the cap on 29 August 2026
by bisection: ten thousand characters pass whole, and one more replaces
the output by a short preview and the path of a file that holds the
rest. The cap counts characters, applies to the sum of everything
injected in one call, and drops content without telling the model; m8's
state file went on marking the dropped facts as delivered, so the loss
was permanent. Two rules follow. The projection is compact by
construction, and bulky content is represented by the command that
produces it, as m8's specification requires of its matchers. And the
record of what a session was shown holds what reached the model, which
the environment can check, since an output over the cap leaves a file
named `hook-*-additionalContext.txt` in the session's directory of tool
results.

The environment also tells a command that a model is reading it.
Claude Code sets `CLAUDECODE=1` and `CLAUDE_CODE_SESSION_ID` in the
environment of the commands it runs, which is the `isatty` of an agent
and more, since the session's identity lets the entrypoint keep, by
itself, what this session has already been shown and withhold it next
time. The same build sets `CLAUDE_EFFORT`, the effort the maintainer
chose, and `CLAUDE_CODE_SESSION_ATTENDED`, whose name says whether a
person attends the session. No variable carries the budget of what the
model can read; `CLAUDE_CODE_MAX_OUTPUT_TOKENS` is the limit of what it
writes. The budget and the detail are therefore declared by the hook
that calls the command, the way HTTP lets a client declare `Accept`,
`Range`, `If-None-Match` and `Prefer`, with sniffing as the default
only.

m8's system is the working precedent: a unit of knowledge is a matcher,
code that decides when, and a payload, markdown that says what; units
are deduplicated by identifier per agent. The step beyond it is to
compute the payload too wherever it describes the state of the world,
since a convention is text and a state is a computation: the decisions
that govern the file just opened, the red requirements that touch it,
the last change to the function and its reason.

## Sensors that exist

Three sensors were written and run on 23 September 2026, and each found
what no rule had caught. Two read the transcripts, the `.jsonl` files
of the Claude Code project directory, whose record kinds the audit's
chapter on reading names; the third runs a document's probes against
the tree. They live here until they move into the module of the work
[E2].

The first measures reading. The transcript stores every read with the
lines it returned and the lines the file had, `startLine`, `numLines`
and `totalLines` under `toolUseResult.file`, and marks a read the token
cap cut with `truncatedByTokenCap`; the read of 22 September carries
the mark. Whole means every line was returned since the file last
changed its length and since the last compaction, whose summary
replaces everything read before it. A file edited without changing its
length keeps its count, which a hash of the content the transcript also
stores would close; a file the session wrote itself is in its window
through the write, which the count leaves out.

```js
// How much of each file the window of a session holds. The transcript
// stores every read with the lines it returned and the lines the file
// had; a file whose length changed between reads starts its count
// again, and a compaction's summary empties the count, since the reads
// before it are gone from the window.
import { readFileSync } from 'node:fs';

const [transcript] = process.argv.slice(2);
const coverage = new Map();
for (const line of readFileSync(transcript, 'utf8').split(/\r?\n/)) {
  let rec;
  try { rec = JSON.parse(line); } catch { continue; }
  if (rec.isCompactSummary) coverage.clear();
  const read = rec.toolUseResult?.file;
  if (!read?.totalLines) continue;
  let seen = coverage.get(read.filePath);
  if (seen?.total !== read.totalLines) seen = { total: read.totalLines, lines: new Set() };
  for (let n = read.startLine; n < read.startLine + read.numLines; n++) seen.lines.add(n);
  coverage.set(read.filePath, seen);
}
for (const [path, { total, lines }] of coverage) {
  console.log(`${lines.size === total ? 'whole' : `${lines.size}/${total}`}\t${path}`);
}
```

The last rule came from the sensor's own first run. Over session
86982eb5 on 23 September 2026 it reported every file of the instruction
file's first tier read whole, and the report was false about the model
that asked: those reads had happened the day before, and the session
had been compacted since, so its window held a summary of them. With
the rule, the same run tells the truth:

```
$ node read-coverage.mjs "$CLAUDE_CONFIG_DIR/projects/D--git-qlang/86982eb5-b2cf-436c-9285-96a0669d39e5.jsonl" | grep -cE 'grammar\.peggy|eval\.mjs|rule10|types\.mjs|core\.qlang|arith\.qlang'
0
```

A gate on reading therefore counts from the last compaction, and the
screen after a compaction names the first tier as unread until it is
read again.

The second holds quotes against their source. Every «…» of a document
must occur, up to whitespace, in a message the maintainer typed: a
record of kind `user` that is not a compaction's summary, or a message
queued while the model worked.

```js
// Hold every «…» quote of the documents against the messages the
// maintainer typed, in every transcript of a project directory. A quote
// matches up to whitespace; an elision is written […] and each fragment
// around it is looked up alone. Fenced blocks are code and are skipped.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [projectDir, ...documents] = process.argv.slice(2);
const squash = text => text.replace(/\s+/g, ' ').trim();

function* typedByMaintainer(rec) {
  if (rec.type === 'queue-operation' && rec.operation === 'enqueue') yield rec.content;
  if (rec.type !== 'user' || rec.isCompactSummary) return;
  const content = rec.message?.content;
  if (typeof content === 'string') yield content;
  else for (const part of content ?? []) if (part.type === 'text') yield part.text;
}

const messages = [];
for (const file of readdirSync(projectDir).filter(name => name.endsWith('.jsonl'))) {
  for (const line of readFileSync(join(projectDir, file), 'utf8').split(/\r?\n/)) {
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    for (const text of typedByMaintainer(rec)) {
      if (typeof text === 'string' && !text.startsWith('<')) {
        messages.push({ session: file.slice(0, 8), at: rec.timestamp.slice(0, 16), text: squash(text) });
      }
    }
  }
}

for (const documentPath of documents) {
  const prose = readFileSync(documentPath, 'utf8')
    .replace(/^```[\s\S]*?^```/gm, fenced => fenced.replace(/[^\n]/g, ' '));
  for (const quoted of prose.matchAll(/«([^»]+)»/g)) {
    const fragments = squash(quoted[1]).split(/\s*\[…\]\s*/).filter(Boolean);
    const found = messages.find(message => fragments.every(fragment => message.text.includes(fragment)));
    const lineNo = prose.slice(0, quoted.index).split('\n').length;
    console.log(found
      ? `ok    ${documentPath}:${lineNo}  ${found.session} ${found.at}`
      : `miss  ${documentPath}:${lineNo}  «${squash(quoted[1]).slice(0, 80)}»`);
  }
}
```

Its first run over both documents, which a rule to quote verbatim had
governed from the start, found the rule broken five ways. The model had
corrected the maintainer's typing in four quotes, «можель», «сокрашался»,
«незименяемые» and «оснвой» turned into their dictionary forms; had
dropped a repeated word from one; had elided twice without a mark; had
dated a queued message by the message it followed; and had searched
only the records of kind `user`, so it filed a queued quote as lost and
carried a normalized copy from its memory instead. Each is repaired in
the audit. In the model's reading this is the case for sensors in one
paragraph: the rule was known, the intention was honest, and the prior
toward correct spelling edited the source anyway; only a measurement
sees that.

The third runs the probes of a document. It reads fenced blocks the
way `extractReplExamples` in `core/test/unit/doc-compliance.test.mjs`
does, with the two changes the audit's notation asks for: a fence
marked `target` inverts the verdict, and answers compare as the printer
writes them, since a probe records what was printed. An answer with …
matches piece by piece, and a query that names an `@` operand runs on
the command line.

```js
// Run the probes of a document against the tree. A probe is a line
// beginning with "> " inside a fenced block, followed by the answer the
// document records; under a fence marked `target` the answer is one the
// tree must not give yet. Answers compare as the printer writes them,
// because a probe records what was printed: a literal answer is read
// and printed again, an answer with … matches piece by piece in order,
// and a query that names an `@` operand runs on the command line. A
// literal answer that prints alike and is another value is lossy: the
// printer dropped something the value had.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const [repo, ...documents] = process.argv.slice(2);
const core = file => import(pathToFileURL(`${repo}/core/src/${file}`).href);
const { evalQuery } = await core('eval.mjs');
const { printValue } = await core('index.mjs');
const { parse } = await core('parse.mjs');
const { deepEqual } = await core('equality.mjs');
const squash = text => text.replace(/\s+/g, ' ').trim();

function probesOf(source) {
  const probes = [];
  let fence = null;
  let open = null;
  const close = () => {
    if (open?.answer.length) probes.push({ ...open, answer: squash(open.answer.join('\n')) });
    open = null;
  };
  source.split('\n').forEach((line, index) => {
    if (line.startsWith('```')) {
      close();
      fence = fence === null ? line.slice(3).trim() : null;
    } else if (fence !== null && line.startsWith('> ')) {
      close();
      open = { target: /\btarget\b/.test(fence), line: index + 1, query: line.slice(2).trim(), answer: [] };
    } else if (open && open.answer.length === 0 && line.startsWith('  ')) {
      open.query += '\n' + line.trim();
    } else if (open && line.trim() === '') {
      close();
    } else if (open) {
      open.answer.push(line);
    }
  });
  close();
  return probes;
}

function onCommandLine(query) {
  try {
    return execFileSync(process.execPath, [`${repo}/cli/src/bin.mjs`, query], { cwd: repo, encoding: 'utf8', stdio: 'pipe' });
  } catch (failed) {
    return `${failed.stdout ?? ''}${failed.stderr ?? ''}`;
  }
}

async function printedByCore(query) {
  try { return squash(printValue(await evalQuery(query))); } catch (thrown) { return `threw ${thrown.message}`; }
}

// An answer that is no literal, a raw string the command line printed,
// compares as the text the command line prints.
async function answersAsRecorded({ query, answer }) {
  if (answer.includes('…')) {
    const printed = squash(onCommandLine(query));
    let from = 0;
    for (const piece of answer.split(/\s*…\s*/).filter(Boolean)) {
      const at = printed.indexOf(piece, from);
      if (at < 0) return false;
      from = at + piece.length;
    }
    return true;
  }
  if (/(^|\W)@\w/.test(query)) return squash(onCommandLine(query)) === answer;
  // A string prints raw, and its text may read as words of the command form.
  if (typeof await evalQuery(query) === 'string' && squash(onCommandLine(query)) === answer) return true;
  try { parse(answer); } catch { return squash(onCommandLine(query)) === answer; }
  if ((await printedByCore(query)) !== (await printedByCore(answer))) return false;
  try { return deepEqual(await evalQuery(query), await evalQuery(answer)) || 'lossy'; } catch { return 'lossy'; }
}

for (const documentPath of documents) {
  for (const probe of probesOf(readFileSync(documentPath, 'utf8'))) {
    const agrees = await answersAsRecorded(probe);
    const verdict = agrees === 'lossy' ? 'LOSSY' : probe.target ? (agrees ? 'MET' : 'target') : (agrees ? 'ok' : 'STALE');
    console.log(`${verdict.padEnd(7)}${documentPath}:${probe.line}  ${probe.query.replace(/\n/g, ' ').slice(0, 70)}`);
  }
}
```

Its first version compared by value, as the compliance test does, and
disagreed with a probe whose print agreed. The disagreement was a
finding: a descriptor of the catalog prints without its `::builtin`
tag and reads back as another value, which the audit now records among
its false comments. The runner keeps both comparisons, so a probe that
prints alike and is another value is reported as lossy. A string prints
raw on the command line, and its text may read as words of the command
form, so the runner holds a string's answer against its raw print first.

```
$ node run-probes.mjs . docs/qlang-audit.md docs/qlang-entrypoint.md | awk '{print $1}' | sort | uniq -c
      2 LOSSY
     10 MET
     67 ok
     20 target
```

The two lossy probes are the descriptor's; every other probe of both
documents gives the recorded answer, and a target the tree now answers
is reported as met.

## What the maintainer repeats

A repetition is a candidate fact, sensor or mode. On 23 September 2026
the model read every message the maintainer typed into the sessions of
this project from 11 September on, queued ones included, and these are
the ones said again in session after session.

The bootstrap. Seven of the nine sessions open with it. It began as a
recipe typed in full, «Сначала твоя задача твоя задача корректно
забутстрапить контекст - для этого тебе надо обязательно затянуть весь
qlang-spec.md и далее весь *.qlang *.peggy и *.mjs код» (maintainer,
2026-09-11 18:14, session f901dcb0), pasted into the next session and
typed again three days later (2026-09-14 14:53, session 268516f5), and
shrank to a command once the recipe moved into the instruction file:
«Бустрапь сессию свою качественно, до тир 2 точно» (2026-09-22 03:51,
session 0ea77851). The command did not end the checking: «Как ты
бутсрапил так контекст что даже грамматику языка не вычитал? Вот как
мне с тобой тогда работать?!!» (2026-09-22 03:16, session 96f3df79).
This is the repetition the entrypoint exists to end, by pushing the
start and by the sensor of reading.

The maintainer's own bootstrap. «сейчас самое медленное звено это я ..
тут надо уже меня "бутстрапить", потому что за этот перерыв я почти все
позабывал..» (2026-09-15 14:18, session f4f0c99b). The first screen
serves both pilots, and a maintainer back from a break reads the same
state the agent reads.

The partner. «что ты делаешь? я тебя просил быть писарем?»
(2026-09-15 23:51, session f4f0c99b); «не надо преврашаться в писаря
секретаршу, сколько можно..» (2026-09-22 02:28, session 96f3df79); and
the model that without the facts «превращается в секретаря-писаря
вместо напарника по интеллектуально работе» (2026-09-23 03:09, session
86982eb5). It came again the same day, an hour after this chapter was
written: «погоди, ты мне кажется опять в писаря превратился..»
(2026-09-23 14:27, session 86982eb5). This belongs to the seed's role,
and to the facts, which are what a partner argues from; a rule written
down did not hold it for an hour, which is the case for a fact pushed at
the moment the model starts to write.

Decisions. «мне нужны решения! и прогресс по цели проекта!»
(2026-09-16 00:14, session f4f0c99b); «почему это мои решения? .. из
чего мне выбирать? можешь разобраться, а то я не понимаю.. что ты можешь
предложить сам?» (2026-09-22 04:37, session 0ea77851); «ТЫ НОРМАЛЬНО
УМЕЕШЬ СНИМАТЬ НЕОПРЕДЕЛЕННОСТЬ!» (2026-09-22 07:54, session 86982eb5).
A fact for every moment the model is about to hand a choice back.

The document as memory. «не надо разводить летопись в
документе.. что тебе эта дата даст?» (2026-09-16 00:22, session
f4f0c99b); «документ с аудитом это переносимая между сессиями память!!
а не производное от твоего контекста!!» (2026-09-22 03:34, session
96f3df79). A fact for every edit of the audit, together with the rules
of its first chapter.

Less text. «где числовая информация мусорная/выводимая из кода или
запусков скриптов, то предлагаю вообще убрать её упоминание из
md-файлов» (2026-09-11 14:09, session 20032899); «если в итоговом диффе
будет больше deletion чем addition -- то для меня это признак того что
шум уменьшается» (2026-09-12 16:24, session 169b0fdb); «мне не надо
переносить выводимое из кода факты обратно в репозиторий.. это все
выводимый мусор, захламляющий проект» (2026-09-22 04:00, session
0ea77851). The first is a convention check already; the second is a
sensor, the sign of a branch's diff by area on the screen; the third is
a fact for every edit of a document.

Verify first. «догадки и допущения здесь неуместны, проверяй все сперва
-- потом можешь делать» (2026-09-12 15:20, session 169b0fdb); «надо не
просто составить пример воспроизводящий проблему, но и по коду или
существующему тесту понять, почему оно работает так а не как ожидалось
или осталось неполным..» (2026-09-22 04:07, session 0ea77851). The probe
runner is the sensor for documents; for claims in a conversation the
fact is pushed when a claim is about to be made.

Synchronization. «И не надо отвечать мне "эхом" на каждое мое долнение
-- просто снимай свою неопределенность и синхронизируйся со мной»
(2026-09-19 06:21, session ad12f85d); «и пожалуйста не тыкай меня в
мелочи, глобально важно понять, архитектурно - все ли ок» (2026-09-22
04:28, session 0ea77851). A fact for the shape of an answer.

Design before files. «я не хочу что б ты ломанулся сразу там править
файлы и создавать правки ради правок» (2026-09-14 14:59, session
268516f5); «пока остаемся просто в дизайне, про имплементацию не
задумывайся» (2026-09-19 04:39, session ad12f85d); «погоди, ты
пытаешься прямо к текущим файлам привязаться и побыстрее
разрезолвиться..» (2026-09-23 03:09, session 86982eb5). This is the
mode, and the reason the screen states it at its top.

The sister project's usage. «твоя посылка что jdt там стейкхолдер
и раз он чем-то не пользуется - значит оно и не надо, если это было так
и мне не показалось, абсолютно неверна» (2026-09-19 09:28, session
ad12f85d); «опять же что делает jdt - не так важно, это не повод для
оптимизаций . уже не раз говорилось» (2026-09-22 05:34, session
0ea77851).

A model's habits. «прочему ты мне вечно суешь эти entries?» (2026-09-19
05:28, session ad12f85d); «меня меня задолбал этими entries/fromEntries
как будто бы это главная проблема какая-то в проекте» (2026-09-22 02:28,
session 96f3df79); «отцепись ты уже от этого qlang-review» (2026-09-22
07:19, session 86982eb5).

In the model's reading the list falls into three kinds, and each has its
place in the design. Facts are pushed at a phase: the conventions of the
audit when it is edited, the shape of an answer before it is written,
the model's habits when they surface. Sensors measure: the reading of
the first tier, the sign of a diff, the quotes, the probes. And the
mode is shown: design before files stands at the top of the screen. The
mode is the kind no rule has held so far, because a rule is read once
at the start and a mode is shown every time.

## Records

The audit numbers its decisions and uses target blocks [D31 in the
audit]; the rest of the record-keeping is designed here and waits for
the maintainer's word.

Decisions live in git, whose history already has what a directory of
records would duplicate: chronology, immutable identity, and blame.
Each new or replacing record lands on master as a commit whose subject
begins with its number, `D14: predicates are strict`, and whose body is
the record: the decision, the source quoted verbatim with its session
and time, what it rests on, and what was set aside with the reason.
The commit also edits the sentences of the audit that the decision
produces, so the record and its projection land together, and `git
blame` on a sentence of the audit leads to the decision behind it.
Commits that implement a decision carry a `Decision: D14` trailer,
beside the `Co-Authored-By` trailer the commits of this project carry
already, so `git log --grep 'Decision: D14'` answers where it was
implemented; a replacing record carries `Supersedes: D9 <hash>`. The
status of a record, standing or replaced, is computed from those
trailers. Only the hashes of master are stable, since this project has
merged its branches by squashing, so a record is always a commit of
master; a decision that surfaces during a branch goes to master first
and the branch continues. Mechanical edits go into
`.git-blame-ignore-revs`, and `git log -L` gives the whole history of a
sentence. The index of decisions is one command:

```sh
$ git log --format='%h %s' --grep='^D[0-9]'
```

Requirements live in the conformance suite, whose format is already a
requirement: a name, a query and the literal it must answer. A case
that confirms a decision names it and is written before the branch,
red. When a branch makes it green, it stays green, a ratchet: a target
that passes moves from the target project into the permanent suite in
the same branch. The audit's probes are the evidence of today and its
`qlang target` blocks the requirements of tomorrow, and the probe
runner, adopted as a vitest project beside the suite, runs both: a
changed answer under a probe marks the sentence around it stale, and a
target that starts to pass says the scar is repaired. The target
project runs on demand and at the start of a session, outside `npm
test` and the CI gate, which stay green.

Metrics are measured against the September master in the same
project: lines by area, core sources, catalog, documents, tests,
against commit `f5e8ec8` through `git show`, which is the seventh
condition of the satisfactory state stated as a test that fails until
it holds; the ratio of comment lines to code lines; the number of
refusal kinds; the weight of `manifest` and of the first screen; and
the proxy benchmark's token bill per task. Each fails with a number,
and the number is the resolution of the moment.

## The shape in qlang

The maintainer sketched the entrypoint in the language itself:
«>qlang '::workflow | start' - где консольный qlang найдет в cwd
папочку с qlang-модулями загрузит их и запустит стартовый скрипт,
который замерит как-то репозиторий программно - и выплюнет
qlang-литералом дашборд в духе темной кабины включающий в себя и
какое-то базовое описание qlang-а и самого процесса и доступных
действий» (maintainer, 2026-09-23 09:46, session 86982eb5).

Read against the audit, that sketch is the first real user of three of
its decisions at once. `::workflow | start`, which became
`::workflow | status` [E5], is a verb found through the subject's tag
[D34 in the audit]: the verb belongs to `::workflow`. The
dashboard is a literal of tagged records, a gate, a task, a decision, a
case, a metric, each a tag with a schema [D6 in the audit], printed as
the cockpit wants it and read back by the next utility. And the zoom is
a query with a tail, the gate's detail, the task's cases, the metric's
history, under the budget and the elision of progressive disclosure
[D21 in the audit].

The mechanism the sketch needs: the command line finds a folder of
modules above the working directory, as git finds its directory,
serves them as host catalogs whose implementations are the sensors,
reading git, the test results, the files and the transcript, loads the
one the query asks for, and applies the verb [E1, E2].
The world of the work becomes a domain like the sister project's graph:
its nouns are tags and addresses, its verbs few. The hook calls the
same command and hands its output to the session within the cap,
declaring the budget and the session's identity. The development of
qlang then exercises qlang's front door on every session, and its tasks
become the benchmark's first domain with real expected values.

## Decisions

The decisions of this document are numbered E1 onward and recorded as
the audit records its own; the audit cites them as [E1 in the
entrypoint document].

### E1 · The modules of the work live in `.qlang/`

Decision. A project keeps the qlang modules of its work in `.qlang/` at
its root. The command line finds the folder by walking up from the
working directory, as git finds `.git`, and serves its modules to
`use`: `.qlang/<name>.qlang` is a module, and `.qlang/<name>.mjs`, when
present, carries the implementations of the module's host operands. A
module loads only when a query asks for it, so the command line run as
a filter inside someone else's repository executes none of its code.
Until mounted namespaces arrive [D24 in the audit] the entrypoint is
`qlang 'use :workflow | start'`; with them the folder is mounted,
`::workflow` finds its module, and the command becomes the maintainer's
sketch.
Source. «где консольный qlang найдет в cwd папочку с qlang-модулями
загрузит их и запустит стартовый скрипт» (maintainer, 2026-09-23 09:46,
session 86982eb5); the folder's name, the search and the loading on
request, the model, 23 September 2026.
Set aside. A visible folder such as `workflow/`, which puts the process
among the product; loading every module of the folder on every run,
which executes a repository's code whenever anyone pipes JSON through
`qlang` inside it; a list of modules in a configuration file, a second
spelling of what the folder already says.
Replaced in part by E5, which makes the command `qlang 'status'`; the
folder, its search and the loading on request stand.

### E2 · Sensors are host operands, the screen is composed in qlang

Decision. The sensors that read git, files and transcripts are host
operands implemented in `.qlang/workflow.mjs` and declared, with their
documents and examples, in `.qlang/workflow.qlang`; the gates, the
facts and the dashboard are composed in qlang in the same module. The
first gates are the gates of milestone 0 in the audit, and the first
instruments are the three sensors of this document.
Source. The model, 23 September 2026: a session's transcript runs to
megabytes of JSON lines, reading it through the language costs more
than the answer is worth, and the sensors exist in JavaScript already.
Set aside. Measurement in qlang over generic host primitives that read
a file or run git, which turns the command line into a runner of
arbitrary reads and still leaves the transcript too heavy to fold in the
language.

### E3 · The first screen is a literal

Decision. `start` answers a value under `::dashboard`, and the command
line prints it as the literal. The dark rendering is a property of the
value, which carries only what deviates, and no renderer stands between
the value and the session. Every part of the value is a record under a
tag the module declares with its document, so the screen explains
itself through `docs`.
Source. «и выплюнет qlang-литералом дашборд в духе темной кабины»
(maintainer, 2026-09-23 09:46, session 86982eb5); the rest, the model,
the same day.
Set aside. A text renderer at the end of the pipe, which gives the
screen a second spelling before the first has been tried.
Replaced in part by E5: the verb is `status`, and its answer is a
record under the tag of the noun it describes.

### E4 · The hook pushes the same screen at every start

Decision. `SessionStart`, for every source it reports, runs the
entrypoint in the repository and returns its output to the session
within the cap. The hook reads the session's transcript through the
path it is given, and the reading it reports counts from the last
compaction. On the maintainer's machine it is configured in
`.claude/settings.local.json`, which git ignores, until the screen has
proved itself; then it moves to `.claude/settings.json`, and every
session of the repository starts from it.
Source. The model, 23 September 2026, from the mechanics of this
document and the first run of the reading sensor.

### E5 · The first command is `qlang 'status'`

Decision. A session starts from `qlang 'status'` in its repository.
The subject is the noun of the nearest `.qlang/` folder [D37 in the
audit], and `status` answers the state of the work as a record under
that noun's tag. `docs` teaches and `status` shows: `::qlang | docs` is
the language on one screen, `::qlang | status` what is mounted and
where the session stands, and each noun's status speaks of that noun
alone, a dependency appearing as a gate that links to the other noun's
status and never as a copy of it. The line that says how to read a
screen and where the documents are is appended by the host once per
session, keyed by the session's identity. `jdt q 'status'` gives the
sister project's screen by the same mechanism.
Source. «если мы уже придумали что status у нас будет отвечать за
онбординг работы с инструментом .. то тогда должна быть команда и
>qlang 'status'» (maintainer, 2026-09-23 16:32, session 86982eb5);
composition by reference and the line once per session, the model, the
same day.
Set aside. A seed that carries the composition,
`qlang '[/ ::jdt] * status'`, which the screen teaches once it has said
that `::jdt` is worth asking; `status` as a verb of the core, which the
maintainer judged a concern of the hosts [D34 in the audit].

## Open questions

The agenda of the next discussion, each with what is known.

The schema of the dashboard: which tags and which fields, and how the
form is versioned so that a session can rely on it the way a script
relies on `git status --porcelain`.

Whether the facts pushed on `PostToolUse` become qlang predicates over
the touched file, in place of m8's matchers.

Where the record of what a session has been shown is kept, keyed by
the session's identity, and when it is dropped.

Which items are sensed and where they gate: whole reads before the
first edit, conventions before a commit, tests before a claim of green,
quotes checked before a document lands. The exact places, and how a
refusal teaches the step that unblocks it, are open.

How the maintainer's intent enters the task: the last message, a queue
of tasks in git, or both.

How the transcript is folded into records: who writes a decision
record from a conversation, at which hook the environment asks for it,
and how the environment notices that the maintainer's message carried a
decision and no record followed.

What happens when the push misses: the fallback is a query, and the
entrypoint's first screen has to say how to ask.
