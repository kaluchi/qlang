// The titles of the tests of every workspace, each read by the parser of
// JavaScript from the call of `it` or `test` that states it, and the rules a
// title names at its head: first the one rule its test holds, the section of
// a chapter or a record in force of a domain its tests hold, and second the
// record in transit that brought it [QSWRK#marks].

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'acorn';

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
// source states, the text of its string, the literal parts of its template
// with `${…}` between them, or null where no literal states it.
export function titlesOfSource(text) {
  const titles = [];
  const visit = node => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === 'CallExpression' && statesATest(node.callee) && !isTable(node.callee) && handsABody(node)) {
      const [first] = node.arguments;
      const title = first?.type === 'Literal' && typeof first.value === 'string' ? first.value
        : first?.type === 'TemplateLiteral' ? first.quasis.map(quasi => quasi.value.cooked).join('${…}') : null;
      titles.push({ line: node.loc.start.line, title });
    }
    for (const key in node) if (key !== 'loc') visit(node[key]);
  };
  visit(parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true }));
  return titles;
}

// The rules at the head of a title, `[QSCLI#answer] [Dnn] reads …`.
const HEAD = /^((?:\[(?:QS[A-Z]{3}(?:#[a-z][a-z-]*)?|[DE]\d+)\] )*)/;

// rulesOfTitle(title) → the rules its head names, in their order.
export const rulesOfTitle = title => [...HEAD.exec(title)[1].matchAll(/\[([^\]]+)\]/g)].map(match => match[1]);

const SECTION = /^QS[A-Z]{3}#[a-z][a-z-]*$/;
const RECORD = /^[DE]\d+$/;

// problemOfTitle({ title, rules }, { heldByItsTests, overridesOf }) → what a
// title breaks, or null: it opens with the one rule its test holds, a section
// or a record `heldByItsTests` names, and names second only a record in
// transit, `overridesOf` its sections, over that section or its chapter.
export function problemOfTitle({ title, rules: [first, second, ...more] }, { heldByItsTests, overridesOf }) {
  if (title === null) return 'states its title by no literal, whose rule a check reads not';
  if (first === undefined) return 'opens with no rule it holds';
  if (!SECTION.test(first) && !(RECORD.test(first) && heldByItsTests(first))) {
    return RECORD.test(first) ? `opens with ${first}, no record in force of a domain its tests hold` : `opens with ${first}, a chapter and not the section of its rule`;
  }
  if (second === undefined) return null;
  if (SECTION.test(second)) return `opens with two rules, ${first} and ${second}: a test holds one`;
  const overrides = overridesOf(second);
  if (overrides === undefined) return `names ${second} second, no record in transit`;
  if (SECTION.test(first) && !overrides.includes(first) && !overrides.includes(first.split('#')[0])) return `names ${second} second, which overrides neither ${first} nor its chapter`;
  return more.length > 0 ? `names ${more.join(', ')} past its rule and its record` : null;
}

// testsOfTree(repoRoot) → [{ file, line, title, rules }]: every test the
// tracked test files of the workspaces state.
export function testsOfTree(repoRoot) {
  const files = execFileSync('git', ['ls-files', '*.test.mjs', '*.test.js'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean);
  return files.flatMap(file => titlesOfSource(readFileSync(join(repoRoot, file), 'utf8'))
    .map(({ line, title }) => ({ file, line, title, rules: title === null ? [] : rulesOfTitle(title) })));
}
