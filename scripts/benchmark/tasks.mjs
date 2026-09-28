// The tasks of the benchmark [D26]: each a question over an input of
// `inputs/`, or over the language alone, the answer the command line
// must print, as JSON or as a qlang literal, and the reference,
// the shortest query the tree answers it with today. The reference is
// no hint to a model under test, which never sees this file; it proves
// the task solvable and names the price the language asks, so a
// reference that shrinks is a repair the runs can be held against.

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
    reference: '/data * (/email | lower) | distinct | count',
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
    question: 'declare a verb of your own named triple that multiplies a number by three, and answer the vector [1 2 3] with every element tripled.',
    reference: ":triple ::verb~(mul 3) | [1 2 3] * triple",
    answer: "[3 6 9]"
  },
  {
    id: 'L2',
    question: 'declare a kind ::Small whose values are numbers below 10, so that building one from 10 or more fails; answer a vector of the kind of ::Small built from 3, and whether building it from 12 fails.',
    reference: "::Small {:impl ~(if (lt 10) ~(/) ~(!{:reason :tooBig}))} | [(::Small(3) | type) (::Small(12) | false !| true)]",
    answer: "[::Small true]"
  },
  {
    id: 'L3',
    question: 'hold the code "subtract 3, then multiply by 4" as a value, and answer a vector of the number of its steps and what it answers when run on 10.',
    reference: "~(sub 3 | mul 4) | :q / | [(q | count) (10 | apply q)]",
    answer: "[2 28]"
  },
  {
    id: 'L4',
    question: 'multiplying the string "a" by 2 fails; answer a vector of the name of that failure and the kind of the value it names as the culprit.',
    reference: "\"a\" | mul 2 !| [type /actualType]",
    answer: "[::MulLeftNotNumberError ::string]"
  },
  {
    id: 'L5',
    question: 'by searching the pages of the verbs that live on strings, find the verb whose page says it tells whether a string begins with a prefix, and answer its address.',
    reference: "::string | spec | /verbs | filter ~(docs | first | content | contains \"begins\") | first",
    answer: "::string/startsWith"
  },
  {
    id: 'L6',
    question: 'put the vector [7 8] under the tag ::Inner and that under the tag ::Outer, and answer a vector of the kind of the result and its second element.',
    reference: "::Outer::Inner[7 8] | [type /1]",
    answer: "[::Outer 8]"
  },
  {
    id: 'L7',
    question: 'add 5 to every element of [10 -1 "y"], where an element that fails answers null.',
    reference: "[10 -1 \"y\"] * (add 5 !| null)",
    answer: "[15 4 null]"
  },
  {
    id: 'L8',
    question: 'write a doc of your own whose prose holds two examples, the code "eq 2" and the code "gt 1", and answer how many examples that doc has.',
    reference: "|~~ two ~(eq 2) and ~(gt 1) ~~| | quotes | count",
    answer: "2"
  },
  {
    id: 'L9',
    question: 'run the examples of the page of the verb that groups the elements of a vector by a key, and answer whether every one of them holds.',
    reference: "::vec/groupBy | runExamples * /ok | every ~(eq true)",
    answer: "true"
  },
  {
    id: 'L10',
    question: 'answer the map {:a 1 :b 2 :c 3} without its key b.',
    reference: "{:a 1 :b 2 :c 3} | minus #[:b]",
    answer: "{:a 1 :c 3}"
  },
  // Navigation: reading the pages of the language several at a time,
  // in the shape the reader names, by one query each.
  {
    id: 'N1',
    question: 'in one query, the text of the page of every kind the language lists.',
    reference: '::qlang | manifest * (docs | first | content)',
    answer: '::qlang | manifest * (docs | first | content)'
  },
  {
    id: 'N2',
    question: 'in one query, a vector of pairs, the address of each verb of strings and the text of its page.',
    reference: '::string | spec | /verbs | sort * [/ (docs | first | content)]',
    answer: '::string | spec | /verbs | sort * [/ (docs | first | content)]'
  },
  {
    id: 'N3',
    question: 'in one query, the kinds whose page links to the page of errors.',
    reference: '::qlang | manifest | filter ~(docs | first | links * (payload | parse) | any ~(contains "::error"))',
    answer: '#[::error ::explanation ::fail]'
  },
  {
    id: 'N4',
    question: 'in one query, how many laws the pages of the verbs of vectors hold in all.',
    reference: '::vec | spec | /verbs | sort * (runExamples | count) | sum',
    answer: '::vec | spec | /verbs | sort * (examples | count) | sum'
  }
];
