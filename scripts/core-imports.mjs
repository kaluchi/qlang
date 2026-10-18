// The imports of the modules of the core, those of `core/src`, the loaders of
// `core/host` and the parser `core/gen` holds, which the grammar writes imports
// of `core/src` into, each module beside the modules of the core its imports
// name, a relative one by its path and one of the `imports` of the package by
// every condition it maps to, in either quote, and their cycles, the strongly
// connected components of that graph of more than one module [QSWRK#tooling].

import { readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';

const IMPORTED = /^\s*(?:import|export)\b[^'"]*?from\s+(['"])([.#][^'"]+)\1|^\s*import\s+(['"])([.#][^'"]+)\3|\bimport\(\s*(['"])([.#][^'"]+)\5\s*\)/gm;

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
  return new Map(modules.map(path => [path, [...readFileSync(join(repoRoot, path), 'utf8').matchAll(IMPORTED)]
    .flatMap(match => targetsOf(path, match[2] ?? match[4] ?? match[6])).filter(target => known.has(target))]));
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
