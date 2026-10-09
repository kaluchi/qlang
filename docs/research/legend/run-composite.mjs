import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runChild } from '../../../scripts/benchmark/child.mjs';

const HERE = join(tmpdir(), 'qlang-legend-research');

const PRIMER = `qlang is a pipeline query language. \`x | f\` hands the value x to the command f as its subject. \`/name\` answers the value under the key :name of a map, \`/0\` the element at position 0 of a vector, and a path reads deeper, \`/a/0/1\`. \`v * f\` runs f on each element of the vector v. \`filter ~(...)\` keeps the elements for which the quoted pipeline answers true; \`gt 3\`, \`eq x\`, \`count\` do what they say. \`{:k v}\` is a map, \`[...]\` a vector, \`#[...]\` a set, \`::Tag{...}\` a value under the tag ::Tag, a label over plain data. \`|~ ... ~|\` is a comment, and \`|~~ ... ~~|\` a doc, prose as a value.`;

const VALUE = `::Pipe{:id 7731 :st :amber :stages [[:build :ok 41.2] [:test :flaky 12.4] [:lint :skip 0]] :owners #[:ann :bob] :fails [["parse/empty" 2] ["eval/deep" 3]]}`;

const VARIANTS = {
  N_none: `A tool answered:

${VALUE}`,

  O_overlay: `A tool answered, and you asked for it with its legend laid over it; the comments are trivia, so this is the same value:

> ${VALUE} | legend
::Pipe{
  :id 7731              |~ the number of the pipeline run ~|
  :st :amber            |~ the verdict: :green, every stage passed at once;
                           :amber, every stage passed, some after a retry;
                           :red, some stage failed ~|
  :stages [             |~ each stage in the order it ran: [name outcome seconds];
                           outcome :ok passed, :flaky passed after a retry,
                           :fail failed, :skip did not run ~|
    [:build :ok 41.2]
    [:test :flaky 12.4]
    [:lint :skip 0]]
  :owners #[:ann :bob]  |~ who is paged when the verdict is :red ~|
  :fails [              |~ each test that failed at least once: [name attempts],
                           the last attempt passed unless the verdict is :red ~|
    ["parse/empty" 2]
    ["eval/deep" 3]]}
|~ next: ~(ok) is true, whether it counts as passed (:green or :amber);
   ~(slowest) is :build, the name of the stage that took longest;
   ~(@retry :stage :test) acts: runs one stage again and answers the new ::Pipe ~|`,

  M_mirror: `A tool answered:

${VALUE}

You asked for its legend, a value of the same shape whose every part is the doc of the part at the same path:

> ${VALUE} | legend
::legend::Pipe{
  :id |~~ the number of the pipeline run ~~|
  :st {:green |~~ every stage passed at once ~~|
       :amber |~~ every stage passed, some after a retry ~~|
       :red |~~ some stage failed ~~|}
  :stages [[|~~ the name of the stage ~~|
            {:ok |~~ passed ~~| :flaky |~~ passed after a retry ~~| :fail |~~ failed ~~| :skip |~~ did not run ~~|}
            |~~ the seconds it took ~~|]]
  :owners #[|~~ one who is paged when the verdict is :red ~~|]
  :fails [[|~~ the name of a test that failed at least once ~~|
           |~~ the attempts it took; the last passed unless the verdict is :red ~~|]]
  :next [|~~ ~(ok) whether it counts as passed (:green or :amber) ~~|
         |~~ ~(slowest) the name of the stage that took longest ~~|
         |~~ ~(@retry :stage :test) acts: runs one stage again and answers the new ::Pipe ~~|]}

In the legend, a vector of one element describes each element of the vector at that path, a map from keywords to docs lists the values a keyword part takes, and :next holds the calls the value answers.`
};

const QUESTIONS = `Answer each question on its own line as "Qn: answer", nothing else.
Q1: Did the lint stage run?
Q2: Write a qlang query that, handed this value, answers the names of the stages that took more than 10 seconds.
Q3: What does the 3 in ["eval/deep" 3] mean?
Q4: Who gets paged, and would they be paged for this run? Answer in eight words or fewer.
Q5: Write a qlang query that answers the names of the tests that needed more than two attempts.
Q6: Write a qlang query that runs the test stage again.
Q7: Write a qlang query that answers the outcomes of all stages as a vector.
Q8: In one sentence, what in what you were shown was unclear or ambiguous, if anything?`;

const models = process.argv.slice(2).length ? process.argv.slice(2) : ['sonnet'];
const runs = [];
for (const model of models) {
  for (const [name, shown] of Object.entries(VARIANTS)) {
    const prompt = `${PRIMER}\n\n${shown}\n\n${QUESTIONS}`;
    const workDir = join(HERE, 'runs', `composite-${model}-${name}`);
    runs.push(runChild({ prompt, model, mode: 'blind', workDir }).then(record => ({ model, name, result: record.result, tokens: record.inputTokens })));
  }
}
const records = await Promise.all(runs);
writeFileSync(join(HERE, `composite-${models.join('-')}.json`), JSON.stringify(records, null, 1));
for (const record of records) console.log(`=== ${record.model} ${record.name} (${record.tokens} tokens in)\n${record.result}\n`);
