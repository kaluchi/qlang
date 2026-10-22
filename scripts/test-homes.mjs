// The home of a test file, the section whose rule its tests hold, named by its
// path as a file of the conformance suite is, `<chapter>/<section>.test.mjs`
// under the tests of its workspace, a part that runs apart from the rest
// `<section>.<part>.test.mjs`, and the record in force a test of a domain
// holds where no chapter states its rule, `D404.test.mjs`; the titles of the
// tests and of their groups, each read by the parser of JavaScript from the
// call of `it`, `test` or `describe` that states it, which cite no rule and
// name no binding the file imports from the code; and the groups, each of two
// tests or more in a file of two groups or more [D414].

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

// A call that states a group of tests: `describe`, under a modifier of vitest
// or of a table, `describe.each([…])`.
const statesAGroup = callee => callee.type === 'Identifier' ? callee.name === 'describe'
  : callee.type === 'MemberExpression' ? !callee.computed && MODIFIERS.has(callee.property.name) && statesAGroup(callee.object)
    : callee.type === 'CallExpression' && statesAGroup(callee.callee);

// The title a call states, the text of its string or the literal parts of its
// template with `${…}` between them; a title no literal states reads none.
function titleOf({ arguments: [first] }) {
  if (first?.type === 'Literal' && typeof first.value === 'string') return first.value;
  return first?.type === 'TemplateLiteral' ? first.quasis.map(quasi => quasi.value.cooked).join('${…}') : null;
}

const LOOPS = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement']);

// The bindings a test file imports from the code, past vitest and the helpers
// of the tests, by a declaration and by `await import(…)` taken apart.
function bindingsImported(program) {
  const imported = new Set();
  const fromTheCode = source => typeof source === 'string' && source !== 'vitest' && !source.includes('/helpers/');
  const visit = node => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === 'ImportDeclaration' && fromTheCode(node.source.value)) for (const { local } of node.specifiers) imported.add(local.name);
    if (node.type === 'VariableDeclarator' && node.id.type === 'ObjectPattern') {
      const init = node.init?.type === 'AwaitExpression' ? node.init.argument : node.init;
      if (init?.type === 'ImportExpression' && fromTheCode(init.source.value)) for (const { value } of node.id.properties) if (value?.type === 'Identifier') imported.add(value.name);
    }
    for (const key in node) if (key !== 'loc') visit(node[key]);
  };
  visit(program);
  return imported;
}

// testsOfSource(text) → `{ tests, groups, testsOutside, imported }`: the title
// of each test the source states with its line, each group with its line, its
// title, the tests it holds, a test written in a loop or in a function a call
// hands on and a table counting as many, and whether it stands in no other,
// the tests outside every group, and the bindings the source imports from the
// code.
export function testsOfSource(text) {
  const program = parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });
  const tests = [];
  const groups = [];
  let testsOutside = 0;
  const visit = (node, within, repeated) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(child => visit(child, within, repeated));
    if (node.type === 'CallExpression' && statesATest(node.callee) && !isTable(node.callee) && handsABody(node)) {
      const title = titleOf(node);
      if (title !== null) tests.push({ line: node.loc.start.line, title });
      const many = repeated || node.callee.type === 'CallExpression' ? 2 : 1;
      for (const group of within) group.tests += many;
      if (within.length === 0) testsOutside += many;
      return;
    }
    if (node.type === 'CallExpression' && statesAGroup(node.callee)) {
      const group = { line: node.loc.start.line, title: titleOf(node), tests: 0, outermost: within.length === 0 };
      groups.push(group);
      return node.arguments.forEach(argument => visit(argument, [...within, group], repeated));
    }
    if (node.type === 'CallExpression') {
      visit(node.callee, within, repeated);
      return node.arguments.forEach(argument => visit(argument, within, repeated || isFunction(argument)));
    }
    if (LOOPS.has(node.type)) return visit(node.body, within, true);
    for (const key in node) if (key !== 'loc') visit(node[key], within, repeated);
  };
  visit(program.body, [], false);
  return { tests, groups, testsOutside, imported: bindingsImported(program) };
}

// titlesOfSource(text) → [{ line, title }]: the title of each test the
// source states.
export const titlesOfSource = text => testsOfSource(text).tests;

// A rule cited in a title, `[QSCLI#answer]` or `[D404]`.
const CITATION = /\[(?:QS[A-Z]{3}(?:#[a-z][a-z-]*)?|[DE]\d+)\]/;

// The code a title names outside its backquotes, which hold the words of the
// language: a file of the code, or a binding the file imports where it is the
// title, opens it before a dash or has the shape of a name of code, a capital
// after a small letter, an underscore or a digit inside it.
function codeNamed(title, imported) {
  const words = title.replace(/`[^`]*`/g, ' ');
  const file = /[\w./-]+\.mjs\b/.exec(words);
  if (file !== null) return `${file[0]}, a file of the code`;
  const names = words.split(/[^\p{L}\p{N}_$]+/u).filter(Boolean);
  const named = names.find((name, index) => imported.has(name)
    && (words.trim() === name || (index === 0 && new RegExp(`^\\s*${name}\\s+—`).test(words)) || /[a-z][A-Z]|.[_\d]/.test(name)));
  return named === undefined ? null : `\`${named}\`, a binding it imports from the code`;
}

// problemsOfTestFile(path, text, { sections, heldByItsTests }) → what a test
// file breaks: a path that names no section `sections` holds and no record
// `heldByItsTests` names, a line that cites the rule its path names, a title
// that cites a rule or names the code, a group of fewer than two tests, and a
// file whose tests stand in one group, each with its line.
export function problemsOfTestFile(path, text, { sections, heldByItsTests }) {
  const problems = [];
  const home = homeOfPath(path);
  if (home === null) problems.push({ line: 1, problem: 'stands at no section: a test file is `<chapter>/<section>.test.mjs` under the tests of its workspace' });
  else if (home.section !== undefined && !sections.has(home.section)) problems.push({ line: 1, problem: `stands at ${home.section}, a section its chapter does not hold` });
  else if (home.record !== undefined && !heldByItsTests(home.record)) problems.push({ line: 1, problem: `stands at ${home.record}, no record in force of a domain its tests hold` });
  const own = home === null ? null : `[${home.section ?? home.record}]`;
  if (own !== null) text.split(/\r?\n/).forEach((line, index) => { if (line.includes(own)) problems.push({ line: index + 1, problem: `cites ${own}, which its path names` }); });
  const { tests, groups, testsOutside, imported } = testsOfSource(text);
  for (const { line, title } of [...tests, ...groups.filter(({ title }) => title !== null)].sort((a, b) => a.line - b.line)) {
    const cited = CITATION.exec(title);
    if (cited !== null) problems.push({ line, problem: `cites ${cited[0]} in its title, which its path names` });
    const code = codeNamed(title, imported);
    if (code !== null) problems.push({ line, problem: `names ${code}: a title says its rule in the words of its section` });
  }
  for (const { line, tests: held } of groups) {
    if (held < 2) problems.push({ line, problem: `groups ${held === 0 ? 'no test' : 'one test'}: a group holds two tests or more, a test of its own standing outside every group` });
  }
  const outermost = groups.filter(({ outermost }) => outermost);
  if (testsOutside === 0 && outermost.length === 1) problems.push({ line: outermost[0].line, problem: 'holds its tests in one group, which says again what its path names' });
  return problems;
}

// testFilesOfTree(repoRoot) → [{ path, text }]: every tracked test file of
// the workspaces.
export function testFilesOfTree(repoRoot) {
  return execFileSync('git', ['ls-files', '*.test.mjs', '*.test.js'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean)
    .map(path => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
}
