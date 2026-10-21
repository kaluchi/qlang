// The home of a test file, the section whose rule its tests hold, named by its
// path as a file of the conformance suite is, `<chapter>/<section>.test.mjs`
// under the tests of its workspace, a part that runs apart from the rest
// `<section>.<part>.test.mjs`, and the record in force a test of a domain
// holds where no chapter states its rule, `D404.test.mjs`; and the titles of
// the tests, each read by the parser of JavaScript from the call of `it` or
// `test` that states it, which cite no rule [QSWRK#marks].

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'acorn';

// The folders of the tests of the workspaces, the tests that run the command
// line in a process of its own apart.
const HOME = /^(?:core\/test\/unit|cli\/test(?:\/integration)?|lsp\/test|site\/test|vscode\/test)\/(?:(QS[A-Z]{3})\/([a-z][a-z-]*)|([DE]\d+))(?:\.([a-z][a-z0-9-]*))?\.test\.m?js$/;

// homeOfPath(path) → `{ section }`, `{ record }` or null, the rule the path
// of a test file names.
export function homeOfPath(path) {
  const match = HOME.exec(path);
  if (match === null) return null;
  const [, chapter, section, record] = match;
  return record === undefined ? { section: `${chapter}#${section}` } : { record };
}

// A call that states a test: `it` or `test`, under a modifier of vitest,
// `it.skip`, or of a table or a condition, `it.each([…])`, `it.skipIf(…)`,
// whose call makes the function that states it.
const MODIFIERS = new Set(['skip', 'only', 'todo', 'fails', 'concurrent', 'sequential', 'each', 'for', 'runIf', 'skipIf']);
const MAKERS = new Set(['each', 'for', 'runIf', 'skipIf']);
const statesATest = callee => callee.type === 'Identifier' ? callee.name === 'it' || callee.name === 'test'
  : callee.type === 'MemberExpression' ? !callee.computed && MODIFIERS.has(callee.property.name) && statesATest(callee.object)
    : callee.type === 'CallExpression' && statesATest(callee.callee);
const isTable = callee => callee.type === 'MemberExpression' && MAKERS.has(callee.property.name);
// A test hands its body after its title, its options standing between them
// where it gives any, `it.todo` alone stating a title with no body.
const isFunction = node => node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';
const handsABody = ({ callee, arguments: [, second, third] }) => isFunction(second) || isFunction(third)
  || (callee.type === 'MemberExpression' && callee.property.name === 'todo');

// titlesOfSource(text) → [{ line, title }]: the title of each test the
// source states, the text of its string or the literal parts of its template
// with `${…}` between them; a title no literal states reads none.
export function titlesOfSource(text) {
  const titles = [];
  const visit = node => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === 'CallExpression' && statesATest(node.callee) && !isTable(node.callee) && handsABody(node)) {
      const [first] = node.arguments;
      const title = first?.type === 'Literal' && typeof first.value === 'string' ? first.value
        : first?.type === 'TemplateLiteral' ? first.quasis.map(quasi => quasi.value.cooked).join('${…}') : null;
      if (title !== null) titles.push({ line: node.loc.start.line, title });
    }
    for (const key in node) if (key !== 'loc') visit(node[key]);
  };
  visit(parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true }));
  return titles;
}

// A rule cited in a title, `[QSCLI#answer]` or `[D404]`.
const CITATION = /\[(?:QS[A-Z]{3}(?:#[a-z][a-z-]*)?|[DE]\d+)\]/;

// problemsOfTestFile(path, text, { sections, heldByItsTests }) → what a test
// file breaks: a path that names no section `sections` holds and no record
// `heldByItsTests` names, a line that cites the rule its path names, and a
// title that cites a rule, each with its line.
export function problemsOfTestFile(path, text, { sections, heldByItsTests }) {
  const problems = [];
  const home = homeOfPath(path);
  if (home === null) problems.push({ line: 1, problem: 'stands at no section: a test file is `<chapter>/<section>.test.mjs` under the tests of its workspace' });
  else if (home.section !== undefined && !sections.has(home.section)) problems.push({ line: 1, problem: `stands at ${home.section}, a section its chapter does not hold` });
  else if (home.record !== undefined && !heldByItsTests(home.record)) problems.push({ line: 1, problem: `stands at ${home.record}, no record in force of a domain its tests hold` });
  const own = home === null ? null : `[${home.section ?? home.record}]`;
  if (own !== null) text.split(/\r?\n/).forEach((line, index) => { if (line.includes(own)) problems.push({ line: index + 1, problem: `cites ${own}, which its path names` }); });
  for (const { line, title } of titlesOfSource(text)) {
    const cited = CITATION.exec(title);
    if (cited !== null) problems.push({ line, problem: `cites ${cited[0]} in its title, which its path names` });
  }
  return problems;
}

// testFilesOfTree(repoRoot) → [{ path, text }]: every tracked test file of
// the workspaces.
export function testFilesOfTree(repoRoot) {
  return execFileSync('git', ['ls-files', '*.test.mjs', '*.test.js'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean)
    .map(path => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
}
