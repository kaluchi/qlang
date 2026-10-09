import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runChild } from '../../../scripts/benchmark/child.mjs';

const HERE = join(tmpdir(), 'qlang-legend-research');

const PRIMER = `qlang is a pipeline query language. \`x | f\` hands the value x to the command f as its subject. \`/0\` answers the element at position 0 of a vector, \`/name\` the value under the key :name of a map. \`v * f\` runs f on each element of the vector v. \`filter ~(...)\` keeps the elements for which the quoted pipeline answers true; \`gt 3\` answers whether its subject is greater than 3, \`eq x\` whether it equals x. \`::Tag[...]\` is a vector under the tag ::Tag, and a tag is a label over the data, which stays a plain vector. A name that begins with @ has an effect on the world outside.`;

const VALUE = '::Run[:amber 214 0 12.4 [::Fail["parse/empty" 2] ::Fail["eval/deep" 3]]]';

const VARIANTS = {
  F1_today: `A tool answered:

${VALUE}

You asked for the pages and the verbs:

> ::Run | doc
|~~ One run of the test suite: its verdict, its counts, its time in
    seconds and the failures it met, each a ::Fail. ~~|

> ::Run | manifest
#[::Run/@rerun ::Run/flaky ::Run/ok]

> ::Fail | doc
|~~ A test that failed at least once during a run. ~~|`,

  F2_authored: `A tool answered:

${VALUE}

You asked for the pages and the verbs:

> ::Run | doc
|~~ One run of the test suite.
    ::part~(/0) the verdict: :green, every test passed at its first
      attempt; :amber, every test passed, some only after a retry;
      :red, some test failed on every attempt
    ::part~(/1) the number of tests that ran
    ::part~(/2) the number of tests that failed on every attempt
    ::part~(/3) the time the run took, in seconds
    ::part~(/4) the tests that failed at least once, each a ::Fail
~~|

> ::Fail | doc
|~~ A test that failed at least once.
    ::part~(/0) the name of the test
    ::part~(/1) the attempts it took; the last one passed when the
      verdict is not :red
~~|

> ::Run | manifest * [/ spec (doc | content)]
[[::Run/@rerun ::spec~(:subject ::Run | :only ::keyword) " Runs again the tests of the failures, :only :flaky or :only :failed, and answers the new ::Run. "]
 [::Run/flaky ::spec~(:subject ::Run) " The names of the tests that passed only after a retry. "]
 [::Run/ok ::spec~(:subject ::Run) " Whether the run counts as passed: true for :green and :amber. "]]`,

  F3_computed: `A tool answered:

${VALUE}

You asked for its legend:

> ${VALUE} | doc
|~~ ::Run, one run of the test suite.

    Its parts:
    ::part~(/0) is :amber, the verdict: :green, every test passed at its
      first attempt; :amber, every test passed, some only after a retry;
      :red, some test failed on every attempt
    ::part~(/1) is 214, the number of tests that ran
    ::part~(/2) is 0, the number of tests that failed on every attempt
    ::part~(/3) is 12.4, the time the run took, in seconds
    ::part~(/4) is a vector of 2 ::Fail, the tests that failed at least
      once ::link~(::Fail | doc)

    What it answers next:
    ::snippet~(ok) is true, whether the run counts as passed: true for
      :green and :amber
    ::snippet~(flaky) is ["parse/empty" "eval/deep"], the names of the
      tests that passed only after a retry
    ::snippet~(@rerun :only :flaky) runs again the tests of the failures,
      :only :flaky or :only :failed, and answers the new ::Run; not run
      here, since it acts on the world
~~|

> ::Fail | doc
|~~ ::Fail, a test that failed at least once.
    ::part~(/0) the name of the test
    ::part~(/1) the attempts it took; the last one passed when the
      verdict is not :red
~~|`,

  F4_laws: `A tool answered:

${VALUE}

You asked for its legend; each quote in it is a check that holds on this value:

> ${VALUE} | doc
|~~ ::Run, one run of the test suite.
    ~(/0 | eq :amber) the verdict: :green, every test passed at its
      first attempt; :amber, every test passed, some only after a retry;
      :red, some test failed on every attempt
    ~(/1 | eq 214) the number of tests that ran
    ~(/2 | eq 0) the number of tests that failed on every attempt
    ~(/3 | eq 12.4) the time the run took, in seconds
    ~(/4 | count | eq 2) the tests that failed at least once, each a
      ::Fail: ~(/4 | /0 | /0 | eq "parse/empty") the name of the test,
      ~(/4 | /0 | /1 | eq 2) the attempts it took, the last one passed
      when the verdict is not :red
    ~(ok | eq true) whether the run counts as passed: true for :green
      and :amber
    ~(flaky | eq ["parse/empty" "eval/deep"]) the names of the tests
      that passed only after a retry
    ::snippet~(@rerun :only :flaky) runs again the tests of the
      failures, :only :flaky or :only :failed, and answers the new
      ::Run; it acts on the world, so no check runs it
~~|`,

  F5_map: `A tool answered:

${VALUE}

You asked for its legend:

> ${VALUE} | legend
{:tag ::Run
 :about "one run of the test suite"
 :parts [{:at ~(/0) :value :amber :means "the verdict" :values {:green "every test passed at its first attempt" :amber "every test passed, some only after a retry" :red "some test failed on every attempt"}}
         {:at ~(/1) :value 214 :means "the number of tests that ran"}
         {:at ~(/2) :value 0 :means "the number of tests that failed on every attempt"}
         {:at ~(/3) :value 12.4 :means "the time the run took, in seconds"}
         {:at ~(/4) :means "the tests that failed at least once" :each {:tag ::Fail :parts [{:at ~(/0) :means "the name of the test"} {:at ~(/1) :means "the attempts it took; the last one passed when the verdict is not :red"}]}}]
 :next [{:run ~(ok) :answers true :means "whether the run counts as passed: true for :green and :amber"}
        {:run ~(flaky) :answers ["parse/empty" "eval/deep"] :means "the names of the tests that passed only after a retry"}
        {:run ~(@rerun :only :flaky) :effect true :means "runs again the tests of the failures, :only :flaky or :only :failed, and answers the new ::Run"}]}`,

  F6_callouts: `A tool answered:

${VALUE}

You asked for its legend:

> ${VALUE} | doc
|~~ ::Run, one run of the test suite.

     /0   :amber   the verdict: :green, every test passed at its first
                   attempt; :amber, every test passed, some only after
                   a retry; :red, some test failed on every attempt
     /1   214      the number of tests that ran
     /2   0        the number of tests that failed on every attempt
     /3   12.4     the time the run took, in seconds
     /4   [2]      the tests that failed at least once, each a ::Fail:
       /4/0/0      the name of the test
       /4/0/1      the attempts it took; the last one passed when the
                   verdict is not :red

     | ok                  true, whether the run counts as passed
     | flaky               ["parse/empty" "eval/deep"], the tests that
                           passed only after a retry
     | @rerun :only :flaky  acts: runs again the tests of the failures,
                           :only :flaky or :only :failed, and answers
                           the new ::Run
~~|`
};

const QUESTIONS = `Answer each question on its own line as "Qn: answer", nothing else.
Q1: Did every test of this run pass in the end? Answer yes or no and why in five words.
Q2: What does the 3 in ::Fail["eval/deep" 3] mean?
Q3: Write a qlang query that, handed a ::Run, answers the names of all the tests that failed at least once.
Q4: Write a qlang query that, handed a ::Run, answers the ::Fail values of the tests that needed more than two attempts.
Q5: What would the first element of a ::Run be if one test failed on every attempt?
Q6: Write a qlang query that runs again only the tests that failed on every attempt.
Q7: What does \`${VALUE} | ok\` answer?
Q8: In one sentence, what in what you were shown was unclear or ambiguous, if anything?`;

const models = process.argv.slice(2).length ? process.argv.slice(2) : ['sonnet'];
const runs = [];
for (const model of models) {
  for (const [name, shown] of Object.entries(VARIANTS)) {
    const prompt = `${PRIMER}\n\n${shown}\n\n${QUESTIONS}`;
    const workDir = join(HERE, 'runs', `run-${model}-${name}`);
    runs.push(runChild({ prompt, model, mode: 'blind', workDir }).then(record => ({ model, name, result: record.result, tokens: record.inputTokens })));
  }
}
const records = await Promise.all(runs);
writeFileSync(join(HERE, `run-${models.join('-')}.json`), JSON.stringify(records, null, 1));
for (const record of records) console.log(`=== ${record.model} ${record.name}\n${record.result}\n`);
