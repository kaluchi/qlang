import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runChild } from '../../../scripts/benchmark/child.mjs';

const HERE = join(tmpdir(), 'qlang-legend-research');

const PRIMER = `qlang is a pipeline query language. \`x | f\` hands the value x to the command f as its subject. \`/0\` answers the element at position 0 of a vector, \`/name\` the value under the key :name of a map. \`v * f\` runs f on each element of the vector v. \`filter ~(...)\` keeps the elements for which the quoted pipeline answers true; \`gt 3\` answers whether its subject is greater than 3. \`::Tag[...]\` is a vector under the tag ::Tag, and a tag is a label over the data, which stays a plain vector.`;

const VARIANTS = {
  F0_bare: `A tool answered:

::Box[1 2 3 4]`,

  F1_today: `A tool answered:

::Box[1 2 3 4]

You asked for its page and its verbs:

> ::Box[1 2 3 4] | doc
|~~ A parcel as the courier measures it: its size in centimetres and
    the weight of what is inside, in kilograms. ~~|

> ::Box | manifest
#[::Box/density ::Box/empty ::Box/put ::Box/volume]`,

  F2_authored: `A tool answered:

::Box[1 2 3 4]

You asked for the page of its tag and its verbs:

> ::Box | doc
|~~ A parcel as the courier measures it.
    ::part~(/0) the length, in centimetres
    ::part~(/1) the width, in centimetres
    ::part~(/2) the height, in centimetres
    ::part~(/3) the weight of what is inside, in kilograms
~~|

> ::Box | manifest * [/ spec (doc | content)]
[[::Box/density ::spec~(:subject ::Box) " Kilograms per cubic centimetre. "]
 [::Box/empty ::spec~(:subject ::Box) " The same box with nothing inside. "]
 [::Box/put ::spec~(:subject ::Box | :weight ::number) " The same box with a weight put inside instead of what was there. "]
 [::Box/volume ::spec~(:subject ::Box) " The space inside, in cubic centimetres. "]]`,

  F3_computed: `A tool answered:

::Box[1 2 3 4]

You asked for its legend:

> ::Box[1 2 3 4] | doc
|~~ ::Box, a parcel as the courier measures it.

    Its parts:
    ::part~(/0) is 1, the length, in centimetres
    ::part~(/1) is 2, the width, in centimetres
    ::part~(/2) is 3, the height, in centimetres
    ::part~(/3) is 4, the weight of what is inside, in kilograms

    What it answers next:
    ::snippet~(volume) is 6, the space inside, in cubic centimetres
    ::snippet~(density) is 0.6666666666666666, kilograms per cubic centimetre
    ::snippet~(empty) is ::Box[1 2 3 0], the same box with nothing inside
    ::snippet~(put 10) is ::Box[1 2 3 10], the same box with a weight put inside instead of what was there
~~|`,

  F4_laws: `A tool answered:

::Box[1 2 3 4]

You asked for its legend; each quote in it is a check that holds on this value:

> ::Box[1 2 3 4] | doc
|~~ ::Box, a parcel as the courier measures it.
    ~(/0 | eq 1) the length, in centimetres
    ~(/1 | eq 2) the width, in centimetres
    ~(/2 | eq 3) the height, in centimetres
    ~(/3 | eq 4) the weight of what is inside, in kilograms
    ~(volume | eq 6) the space inside, in cubic centimetres
    ~(density | eq 0.6666666666666666) kilograms per cubic centimetre
    ~(empty | eq ::Box[1 2 3 0]) the same box with nothing inside
    ~(put 10 | eq ::Box[1 2 3 10]) the same box with a weight put inside instead of what was there
~~|`,

  F5_map: `A tool answered:

::Box[1 2 3 4]

You asked for its legend:

> ::Box[1 2 3 4] | legend
{:tag ::Box
 :about "a parcel as the courier measures it"
 :parts [{:at ~(/0) :value 1 :means "the length, in centimetres"}
         {:at ~(/1) :value 2 :means "the width, in centimetres"}
         {:at ~(/2) :value 3 :means "the height, in centimetres"}
         {:at ~(/3) :value 4 :means "the weight of what is inside, in kilograms"}]
 :next [{:run ~(volume) :answers 6 :means "the space inside, in cubic centimetres"}
        {:run ~(density) :answers 0.6666666666666666 :means "kilograms per cubic centimetre"}
        {:run ~(empty) :answers ::Box[1 2 3 0] :means "the same box with nothing inside"}
        {:run ~(put 10) :answers ::Box[1 2 3 10] :means "the same box with a weight put inside instead of what was there"}]}`
};

const QUESTIONS = `Answer each question on its own line as "Qn: answer", nothing else.
Q1: What does the number 4 in ::Box[1 2 3 4] mean?
Q2: Write a qlang query that answers the height of a ::Box handed to it as the subject.
Q3: What does \`::Box[5 5 5 2] | empty\` answer?
Q4: What does \`::Box[1 2 3 4] | put 7 | density\` answer? Give the number.
Q5: Write a qlang query that, handed a vector of ::Box values, keeps those whose contents weigh more than 3 kilograms.
Q6: What does \`::Box[2 2 2 1] | volume\` answer?
Q7: In one sentence, what in what you were shown was unclear or ambiguous, if anything?`;

const models = process.argv.slice(2).length ? process.argv.slice(2) : ['sonnet'];
const runs = [];
for (const model of models) {
  for (const [name, shown] of Object.entries(VARIANTS)) {
    const prompt = `${PRIMER}\n\n${shown}\n\n${QUESTIONS}`;
    const workDir = join(HERE, 'runs', `${model}-${name}`);
    runs.push(runChild({ prompt, model, mode: 'blind', workDir }).then(record => ({ model, name, result: record.result, tokens: record.inputTokens })));
  }
}
const records = await Promise.all(runs);
writeFileSync(join(HERE, `box-${models.join('-')}.json`), JSON.stringify(records, null, 1));
for (const record of records) console.log(`=== ${record.model} ${record.name}\n${record.result}\n`);
