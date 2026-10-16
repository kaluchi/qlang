# Разбор прохода консилиума по всем записям

Чтение модели, сессия d7f52e95, 2026-10-16. Отчёт — [D353~1.md](D353~1.md):
последний агент workflow сессии `decide-open-records`, прочитавший
консенсусы D327, D338, D339, D340, D341, D342 и D344 с вердиктами
проверяющих, на дереве b9cc59ec ветки the-open-roads-chosen.

## Судьба

- Конфликты между записями: каждый разрешён, как написал проход, и идёт в
  решения записей первой пачкой [D353].
- Пачки и их порядок: взяты в решение [D353] как есть; мерка каждой пачки —
  подсказка мейнтейнера, «рубим ли мы этим мосты с прошлым» (14:23):
  заменяемое пишется заново по главам и кейсам, старая дорога уходит в той
  же пачке, второй дороги рядом с новой нет.
- Абзац для цели: проход просит записать принцип слов в принципы
  `docs/journal/AIM.md`. Цель — мерило мейнтейнера, и модель её не
  дописывает: вопрос отдан ему (2026-10-16, сессия d7f52e95); до его слова
  принцип и процедура стоят в [D349], которая на переносе растворяется в
  [QSWRK#documents].

## Промпты

Скрипт workflow, как он был запущен; каждый агент получил `CONTEXT` и
промпт своего этапа:

```js
export const meta = {
  name: 'decide-open-records',
  description: 'Three deciders per open record of the set, a reconciler, an adversarial checker, and one cross-record consistency pass',
  phases: [
    { title: 'Propose', detail: 'three lenses decide every part of each record' },
    { title: 'Reconcile', detail: 'one consensus per record' },
    { title: 'Refute', detail: 'a skeptic holds each consensus against the tree' },
    { title: 'Cohere', detail: 'one pass over all records: conflicts and the order of the work' },
  ],
}

const REPO = 'D:/git/qlang'
const RECORDS = [
  { id: 'D338', scope: 'only its items 71 and 75, the two still open', critique: null },
  { id: 'D339', scope: 'every part', critique: 'docs/journal/research/design-check/D339~1.md and D339~1~reading.md' },
  { id: 'D340', scope: 'every part', critique: 'docs/journal/research/design-check/D340~1.md and D340~1~reading.md' },
  { id: 'D341', scope: 'every part', critique: 'docs/journal/research/design-check/D341~1.md and D341~1~reading.md' },
  { id: 'D342', scope: 'its question whole', critique: null },
  { id: 'D344', scope: 'every part', critique: null },
  { id: 'D327', scope: 'every road still open', critique: 'docs/journal/research/design-check/D327~1.md and D327~1~reading.md' },
]

const CONTEXT = `You work on the qlang repository at ${REPO} (Windows, Git Bash), on the branch the-open-roads-chosen, whose tree is master. READ ONLY: edit no file, commit nothing, create no branch. Run the language as \`qlang '<query>' < /dev/null\` (write \`MSYS_NO_PATHCONV=1 qlang '…' < /dev/null\` where a query begins with \`/\`); read files with the file-reading tool, whole; filter long shell output instead of printing it whole.

The maintainer handed the choice of the open records to the model, in the words «делай ветку новую сразу .. че стоять.. давай снимать какие-то блокировки здесь... я думал вы самостоятельно сможете прийти к какому-то консенсусу..  ты сам проект знаешь лучше меня» (maintainer, 2026-10-16 12:15 UTC, session d7f52e95): the questions these records put to him are the model's to decide now, by a consensus of independent readers. His principle of words, given at the same sitting: «высокоэнтропийные слова у нас предпочтительнее же» (maintainer, 2026-10-16 12:17 UTC, session d7f52e95), and earlier «а причины замены проекции на пас какие? пас ведь низкоэнтропийное слово..» (2026-10-13 03:09 UTC, d65e4c1d) and «подыскать другую пару терминов, высокоэнтропийных и несущих точный смысл» (2026-10-16 01:51 UTC, 82eca2eb): a distinctive word with one exact sense is preferred to a common word that names many things.

The rules that still hold (CLAUDE.md, docs/spec/QSWRK-the-work.md): a capability of the language, a form of the grammar, the shape of a value or a word is removed only on the maintainer's words about that axis; his delegation above covers the questions these records ask him, and a removal you choose still needs its reason in the aim and must be flagged as a removal. Before choosing a construct or a word, search his words about it: \`node scripts/sensors/maintainer-messages.mjs 2>/dev/null | grep -i -E '<words>' | cut -c1-400\`; a word he chose stays his unless his words now say otherwise, and you quote what you rely on with its session and time. Do not read or scan D:/git/eclipse-jdt-search; the sister project's cost of a renamed word of the surface is stated in words, not measured.`

const PROPOSE = (rec, lens) => `${CONTEXT}

Your task: decide the open record ${rec.id}, ${rec.scope}. Read whole first: docs/journal/AIM.md (the mission, the satisfactory state and the principles a choice is weighed by), docs/journal/${rec.id}.md${rec.critique ? `, its critique by a clean reader, ${rec.critique} under docs/journal/research/design-check/` : ''}, and the records in force and the sections of docs/spec/ it cites where a part rests on them. Run the probes of the parts you decide and see that they still answer as written; where one no longer does, say so, the tree having moved.

Your lens, the one weight you add to the principles of the aim: ${lens}

For each part (each numbered part, or each item or road named in the scope), choose one road: a road the record names under Alternatives, a road of your own the tree and the aim show better, or the text as it stands. Decide every part, consistent with each other: the decision of one part must not undo another's. Return per part: the part; the road in one sentence; the decision as it would stand in the record, in the present, what holds once done, in the words of the language; why, naming the principle of the aim or the rule of the work it serves; the cost, the cases, sections, pages, words of the surface and refusals it changes; what it removes, a capability, a form, the shape of a value or a word, or none; the maintainer's words you found on that axis, quoted with session and time, or none; the size of the work, S, M or L, and the files or folders it touches.`

const LENSES = [
  'the mission: the first attempt of a fresh model and the weight of its reading. Choose the road on which a clean reader, handed the first page and the pages of the catalog, meets the fewest concepts, the fewest exceptions and the least to unlearn.',
  'the work and the code: one fact one spelling, one name for one thing, the order of concepts the order of dependencies, a diff that deletes more than it adds, and no compromise left in the code to explain itself. Choose the road that leaves fewer things behind.',
  'the words and the surface: words carry paradigms and high-entropy words are preferred, one exact sense each; what a host, a page and an existing query rely on has a cost when it changes in one release. Choose the distinctive word, and stability where the gain is small.',
]

const PART = {
  type: 'object',
  properties: {
    part: { type: 'string' },
    road: { type: 'string' },
    decision: { type: 'string' },
    why: { type: 'string' },
    cost: { type: 'string' },
    removes: { type: 'string' },
    maintainerWords: { type: 'string' },
    size: { type: 'string', enum: ['S', 'M', 'L'] },
    files: { type: 'string' },
  },
  required: ['part', 'road', 'decision', 'why', 'cost', 'removes', 'maintainerWords', 'size', 'files'],
}
const PROPOSAL = {
  type: 'object',
  properties: { record: { type: 'string' }, probesMoved: { type: 'string' }, parts: { type: 'array', items: PART } },
  required: ['record', 'probesMoved', 'parts'],
}
const CONSENSUS = {
  type: 'object',
  properties: {
    record: { type: 'string' },
    parts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ...PART.properties,
          agreement: { type: 'string', enum: ['3/3', '2/3', 'split'] },
          rationale: { type: 'string' },
        },
        required: [...PART.required, 'agreement', 'rationale'],
      },
    },
    crossRecord: { type: 'string' },
  },
  required: ['record', 'parts', 'crossRecord'],
}
const VERDICTS = {
  type: 'object',
  properties: {
    record: { type: 'string' },
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          part: { type: 'string' },
          refuted: { type: 'boolean' },
          reason: { type: 'string' },
          probe: { type: 'string' },
          repair: { type: 'string' },
        },
        required: ['part', 'refuted', 'reason', 'probe', 'repair'],
      },
    },
  },
  required: ['record', 'verdicts'],
}
const COHERENCE = {
  type: 'object',
  properties: {
    conflicts: { type: 'array', items: { type: 'object', properties: { records: { type: 'string' }, conflict: { type: 'string' }, resolution: { type: 'string' } }, required: ['records', 'conflict', 'resolution'] } },
    batches: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, parts: { type: 'string' }, area: { type: 'string' }, order: { type: 'number' }, why: { type: 'string' } }, required: ['name', 'parts', 'area', 'order', 'why'] } },
    newPrinciple: { type: 'string' },
  },
  required: ['conflicts', 'batches', 'newPrinciple'],
}

const results = await pipeline(
  RECORDS,
  rec => parallel(LENSES.map((lens, at) => () =>
    agent(PROPOSE(rec, lens), { label: `propose:${rec.id}:${['mission', 'work', 'words'][at]}`, phase: 'Propose', schema: PROPOSAL }))),
  (proposals, rec) => {
    const given = proposals.filter(Boolean)
    return agent(`${CONTEXT}

Three independent deciders answered the open record ${rec.id} (${rec.scope}), each through one lens: the mission, the work and the code, the words and the surface. Their answers, as JSON:

${JSON.stringify(given, null, 1)}

Read docs/journal/AIM.md and docs/journal/${rec.id}.md whole, then reconcile them into one decision per part: where two or three agree, take that road and write its decision in its best form; where they part, choose by the principles of the aim and the maintainer's principle of words, and say which principle decided; keep every part consistent with every other; decide all the axes of the record at once, so the work runs without a turn back. Where a part's decision rests on a decision of another record of the set, D338, D339, D340, D341, D342, D344 or D327 (the words of D341 above all), say so in crossRecord. Return the consensus per part with its agreement, 3/3, 2/3 or split, and its rationale.`, { label: `reconcile:${rec.id}`, phase: 'Reconcile', schema: CONSENSUS })
  },
  (consensus, rec) => {
    if (!consensus) return null
    return agent(`${CONTEXT}

You are an adversarial checker. A consensus of three deciders chose a road for each part of the open record ${rec.id}:

${JSON.stringify(consensus, null, 1)}

Try to refute each decision against the tree: run the probes of the part, read the sections of docs/spec, the cases under core/test/conformance, the pages under core/lib and cli/lib, and the code the decision touches. A decision is refuted when it contradicts a rule of a chapter that it does not itself change, breaks a case it does not account for, contradicts the maintainer's quoted words on that axis (search them with the sensor), contradicts a record in force outside the set, removes something the aim needs, or rests on a claim about the tree that a probe shows false. Default to refuted where a claim of the decision is not verified. For each part return refuted or not, the reason, the probe you ran with its answer, and the repair that would make the decision stand, or none.`, { label: `refute:${rec.id}`, phase: 'Refute', schema: VERDICTS }).then(verdicts => ({ record: rec.id, consensus, verdicts }))
  },
)

const decided = results.filter(Boolean)
log(`${decided.length} of ${RECORDS.length} records reconciled and checked`)

phase('Cohere')
const coherence = await agent(`${CONTEXT}

The consensus decisions of the open records of the set, each with the adversarial verdicts on its parts:

${JSON.stringify(decided, null, 1)}

Read docs/journal/AIM.md. Find where the decisions of different records conflict, one word chosen two ways, a mechanism one record keeps and another removes, a part one record repairs that another rebuilds, and say how each conflict resolves by the aim. Then order the work: batches of parts that one agent can carry in its own worktree, each batch named, its parts by record and part, its area (catalog pages, the evaluator, the words across the texts, the tools, the cases), and an order in which no batch undoes or blocks a later one, the words first where a decision renames. Finally, if the maintainer's principle of words, high-entropy words preferred, should stand among the principles of docs/journal/AIM.md, write the paragraph in the voice of the principles there, else write none.`, { label: 'cohere', phase: 'Cohere', schema: COHERENCE })

return { decided, coherence }
```

[D349]: ../../D349.md
[D353]: ../../D353.md
[QSWRK#documents]: ../../../spec/QSWRK-the-work.md#documents
