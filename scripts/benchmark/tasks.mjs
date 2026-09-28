// The tasks of the benchmark [D26]: each a question over an input of
// `inputs/`, the answer the command line must print, and the reference,
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
  }
];
