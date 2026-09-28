// The tasks of the benchmark [D26]: each a question over an input of
// `inputs/`, or over the language alone, the answer the command line
// must print, as JSON or as a qlang literal, and the reference,
// the shortest query the tree answers it with today. The reference is
// no hint to a model under test, which never sees this file; it proves
// the task solvable and names the price the language asks, so a
// reference that shrinks is a repair the runs can be held against.

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const caseFolds = [...UPPER].map(letter => `~(eq "${letter}") ~("${letter.toLowerCase()}")`).join(' ');

export const TASKS = [
  {
    id: 'T1', input: 'users.json',
    question: 'the names of the users whose role is "admin", oldest first. Expected shape: a JSON array of strings.',
    reference: '/data | filter ~(/role | eq "admin") | sort ~(/age) | reverse * /name',
    answer: '["Cid","Ann"]'
  },
  {
    id: 'T2', input: 'users.json',
    question: 'how many distinct email addresses there are when compared case-insensitively. Expected shape: a number.',
    reference: `:fold ::verb~(split "" * cond ${caseFolds} ~(/) | join "") | /data * (/email | fold) | distinct | count`,
    answer: '4'
  },
  {
    id: 'T3', input: 'orders.json',
    question: 'the number of orders per status. Expected shape: a JSON object status → count.',
    reference: 'groupBy ~(/status | keyword) * count',
    answer: '{"paid":3,"pending":2,"cancelled":1}'
  },
  {
    id: 'T4', input: 'orders.json',
    question: 'the total amount of the "paid" orders per customer. Expected shape: a JSON object customer → sum.',
    reference: 'filter ~(/status | eq "paid") | groupBy ~(/customer | keyword) * (* /amount | sum)',
    answer: '{"acme":160.5,"globex":300}'
  },
  {
    id: 'T5', input: 'app.log', raw: true,
    question: 'the distinct messages of the ERROR lines, where the message is the text after the level word. Expected shape: a JSON list of strings.',
    reference: 'lines | filter ~(contains "ERROR") * (split "ERROR " | last) | distinct | sort | json',
    answer: '["db timeout"]'
  },
  {
    id: 'T6', input: 'users.json',
    question: 'for each user an object with its id and the number of its tags, keys "id" and "tagCount". Expected shape: array of objects.',
    reference: '/data * {:id /id :tagCount (/tags | count)}',
    answer: '[{"id":1,"tagCount":2},{"id":2,"tagCount":1},{"id":3,"tagCount":1},{"id":4,"tagCount":0},{"id":5,"tagCount":2}]'
  },
  {
    id: 'T7', input: 'users.json',
    question: 'the emails of the users having the tag "ops". Expected shape: array of strings.',
    reference: '/data | filter ~(/tags | any ~(eq "ops")) * /email',
    answer: '["Ann@Example.com","eve@example.com"]'
  },
  // The language itself: its literals, its own verbs and tags, code as a
  // value, docs, errors as values, and the pages it answers questions
  // with. Each runs on no input, and its answer is a qlang literal.
  {
    id: 'L1',
    question: 'declare a verb of your own named double that multiplies a number by two, and answer the vector [1 2 3] with every element doubled.',
    reference: ':double ::verb~(mul 2) | [1 2 3] * double',
    answer: '[2 4 6]'
  },
  {
    id: 'L2',
    question: 'declare a kind ::Pos whose values are positive numbers, so that building one from a non-positive number fails; answer a vector of the kind of ::Pos built from 5, and whether building it from -1 fails.',
    reference: '::Pos {:impl ~(if (gt 0) ~(/) ~(!{:reason :notPositive}))} | [(::Pos(5) | type) (::Pos(-1) | false !| true)]',
    answer: '[::Pos true]'
  },
  {
    id: 'L3',
    question: 'hold the code "add 1, then multiply by 2" as a value, and answer a vector of the number of its steps and what it answers when run on 5.',
    reference: '~(add 1 | mul 2) | :q / | [(q | count) (5 | apply q)]',
    answer: '[2 12]'
  },
  {
    id: 'L4',
    question: 'adding 1 to the string "a" fails; answer a vector of the name of that failure and the kind of the value it names as the culprit.',
    reference: '"a" | add 1 !| [type /actualType]',
    answer: '[::AddLeftNotNumberError ::string]'
  },
  {
    id: 'L5',
    question: 'by searching the pages of the verbs that live on vectors, find the verb whose page says it answers the elements after the first count, and answer its address.',
    reference: '::vec | spec | /verbs | filter ~(docs | first | content | contains "after the first") | first',
    answer: '::vec/drop'
  },
  {
    id: 'L6',
    question: 'put the map {:a 1} under the tag ::Crate and that under the tag ::Box, and answer a vector of the kind of the result and its field a.',
    reference: '::Box::Crate{:a 1} | [type /a]',
    answer: '[::Box 1]'
  },
  {
    id: 'L7',
    question: 'multiply every element of [1 "x" 3] by 2, where an element that fails answers 0.',
    reference: '[1 "x" 3] * (mul 2 !| 0)',
    answer: '[2 0 6]'
  },
  {
    id: 'L8',
    question: 'write a doc of your own whose prose holds one example, the code "eq 1", and answer the examples of that doc.',
    reference: '|~~ one ~(eq 1) ~~| | quotes',
    answer: '[~(eq 1)]'
  },
  {
    id: 'L9',
    question: 'run the examples of the page of the verb that sorts a vector, and answer whether every one of them holds.',
    reference: '::vec/sort | runExamples * /ok | every ~(eq true)',
    answer: 'true'
  },
  {
    id: 'L10',
    question: 'answer the map {:a 1 :b 2} without its key a.',
    reference: '{:a 1 :b 2} | minus #[:a]',
    answer: '{:b 2}'
  }
];
