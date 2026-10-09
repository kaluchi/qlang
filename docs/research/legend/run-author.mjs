import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runChild } from '../../../scripts/benchmark/child.mjs';

const HERE = join(tmpdir(), 'qlang-legend-research');

const STYLES = {
  A_parts: `:Box
  |~~ A parcel as the courier measures it.
      ::part~(/0) the length, in centimetres
      ::part~(/1) the width, in centimetres
      ::part~(/2) the height, in centimetres
      ::part~(/3) the weight of what is inside, in kilograms
  ~~|
  ::spec~()

:Box/volume
  |~~ The space inside, in cubic centimetres.
      ~(::Box[1 2 3 4] | volume | eq 6)
  ~~|
  ::verb~(take 3 | reduce 1 ~(mul))

:Box/heavy
  |~~ Whether what is inside weighs more than the limit, in kilograms.
      ~(::Box[1 2 3 4] | heavy 3 | eq true)
  ~~|
  ::verb~(:limit ::number | /3 | gt limit)`,

  C_named: `:Box
  |~~ A parcel as the courier measures it: its length, width and height,
      then the weight of what is inside. ~~|
  ::spec~()

:Box/length |~~ The length, in centimetres. ~~| ::verb~(/0)
:Box/width |~~ The width, in centimetres. ~~| ::verb~(/1)
:Box/height |~~ The height, in centimetres. ~~| ::verb~(/2)
:Box/weight |~~ The weight of what is inside, in kilograms. ~~| ::verb~(/3)

:Box/volume
  |~~ The space inside, in cubic centimetres.
      ~(::Box[1 2 3 4] | volume | eq 6)
  ~~|
  ::verb~(take 3 | reduce 1 ~(mul))

:Box/heavy
  |~~ Whether what is inside weighs more than the limit, in kilograms.
      ~(::Box[1 2 3 4] | heavy 3 | eq true)
  ~~|
  ::verb~(:limit ::number | weight | gt limit)`
};

const TASK = `Here is how a kind and its verbs are declared in qlang, a pipeline language where \`x | f\` hands x to f, \`/0\` reads position 0 of a vector, \`filter ~(...)\` keeps elements, \`* f\` maps, \`gt\`, \`eq\`, \`count\`, \`take\`, \`any ~(...)\` and \`every ~(...)\` do what they say. A doc |~~ ... ~~| holds prose; a quote ~(...) in it with no tag is a law that must answer true.

`;

const FACTS = `

Now declare, in the same style and nothing else, the kind ::Run for one run of a test suite, a vector of five parts in this order: the verdict, a keyword, :green when every test passed at its first attempt, :amber when every test passed but some only after a retry, :red when some test failed on every attempt; the number of tests that ran; the number of tests that failed on every attempt; the time the run took in seconds; and a vector of the tests that failed at least once, each a ::Fail, a vector of the test's name and the number of attempts it took. Declare ::Fail the same way, and two verbs of ::Run: ok, whether the run counts as passed (true for :green and :amber), and slow, whether the run took more than a limit of seconds handed to it. Give each verb one law over an example run. Answer with the qlang source alone, no fences, no commentary.`;

const models = process.argv.slice(2).length ? process.argv.slice(2) : ['sonnet'];
const runs = [];
for (const model of models) {
  for (const [name, sample] of Object.entries(STYLES)) {
    const workDir = join(HERE, 'runs', `author-${model}-${name}`);
    runs.push(runChild({ prompt: TASK + sample + FACTS, model, mode: 'blind', workDir }).then(record => ({ model, name, result: record.result })));
  }
}
const records = await Promise.all(runs);
for (const record of records) writeFileSync(join(HERE, `author-${record.model}-${record.name}.qlang`), record.result ?? '');
for (const record of records) console.log(`=== ${record.model} ${record.name}\n${record.result}\n`);
