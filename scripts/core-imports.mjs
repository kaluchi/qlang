// The imports of the modules of the core, those of `core/src`, the loaders of
// `core/host` and the parser `core/gen` holds, which the grammar writes imports
// of `core/src` into, each module beside the modules of the core its imports
// name, a relative one by its path and one of the `imports` of the package by
// every condition it maps to, in either quote, and their cycles, the strongly
// connected components of that graph of more than one module [QSGAT#imports].

import { readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { parse } from 'acorn';

// The specifiers a module names, read by the parser of JavaScript [D434]:
// its imports and re-exports, and an import its code calls with a literal,
// those of the core alone, a relative path or a name of the `imports` of
// the package.
function specifiersOf(text) {
  const found = [];
  const visit = node => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (/^(?:Import|ExportAll|ExportNamed)Declaration$|^ImportExpression$/.test(node.type) && typeof node.source?.value === 'string') found.push(node.source.value);
    for (const key in node) if (key !== 'loc') visit(node[key]);
  };
  visit(parse(text, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }));
  return found.filter(specifier => specifier.startsWith('.') || specifier.startsWith('#'));
}

const conditionsOf = target => (typeof target === 'string' ? [target] : Object.values(target ?? {}));

// importsOfCore(repoRoot) → each module of the core by its path from the root
// of the repository, `core/src/eval.mjs`, beside the modules of the core it
// imports.
export function importsOfCore(repoRoot) {
  const mapped = JSON.parse(readFileSync(join(repoRoot, 'core', 'package.json'), 'utf8')).imports;
  const modules = ['src', 'gen', 'host'].flatMap(folder => readdirSync(join(repoRoot, 'core', folder), { recursive: true })
    .map(name => `core/${folder}/${String(name).replaceAll('\\', '/')}`))
    .filter(path => path.endsWith('.mjs')).sort();
  const known = new Set(modules);
  const targetsOf = (path, specifier) => (specifier.startsWith('#')
    ? conditionsOf(mapped[specifier]).map(target => posix.join('core', target))
    : [posix.join(posix.dirname(path), specifier)]);
  return new Map(modules.map(path => [path, specifiersOf(readFileSync(join(repoRoot, path), 'utf8'))
    .flatMap(specifier => targetsOf(path, specifier)).filter(target => known.has(target))]));
}

// cyclesOf(imports) → the strongly connected components of more than one
// module, each in the order of its paths.
export function cyclesOf(imports) {
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];
  let counter = 0;
  const visit = module => {
    index.set(module, counter);
    low.set(module, counter);
    counter += 1;
    stack.push(module);
    onStack.add(module);
    for (const target of imports.get(module)) {
      if (!index.has(target)) {
        visit(target);
        low.set(module, Math.min(low.get(module), low.get(target)));
      } else if (onStack.has(target)) {
        low.set(module, Math.min(low.get(module), index.get(target)));
      }
    }
    if (low.get(module) !== index.get(module)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== module);
    if (component.length > 1) components.push(component.sort());
  };
  for (const module of imports.keys()) if (!index.has(module)) visit(module);
  return components;
}
