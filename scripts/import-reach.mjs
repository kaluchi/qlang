// What the tests reach of the code through its imports [QSWRK#marks]: every
// module of the workspaces read by the parser of JavaScript into its
// declarations, the names each reads and the code it runs as it loads, and
// the declarations a test file reaches from what it imports, through the
// names each declaration reads, the modules each import loads and the code
// they run as they load. A name a string holds reaches nothing, and a verb a
// query runs is reached by the text of the query, which no import tells.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import { parse } from 'acorn';
import { readText } from './tree-reads.mjs';

const MODULE = /\.(mjs|js)$/;
const OUTSIDE = /^(docs|scripts\/benchmark\/sets)\//;

// The doors of the packages of the workspaces, the name a workspace beside a
// package imports it by and the module each door leads to, and the imports of
// a package by `#`, a module for Node chosen where the condition names one.
function doorsOf(root) {
  const doors = new Map();
  for (const workspace of ['core', 'cli', 'lsp', 'site', 'vscode']) {
    const path = join(root, workspace, 'package.json');
    if (!existsSync(path)) continue;
    const { name, exports, imports } = JSON.parse(readText(path));
    const leadTo = target => {
      const chosen = typeof target === 'string' ? target : target.import ?? target.node;
      return typeof chosen === 'string' && MODULE.test(chosen) ? posix.join(workspace, chosen) : null;
    };
    for (const [door, target] of Object.entries(exports ?? {})) {
      const to = leadTo(target);
      if (to !== null) doors.set(door === '.' ? name : `${name}/${door.slice(2)}`, to);
    }
    for (const [door, target] of Object.entries(imports ?? {})) {
      const to = leadTo(target);
      if (to !== null) doors.set(`${workspace}:${door}`, to);
    }
  }
  return doors;
}

// The module an import names, a path of the tree, or null for a module
// outside the workspaces.
function resolverOf(doors) {
  return (from, specifier) => {
    if (typeof specifier !== 'string') return null;
    if (specifier.startsWith('.')) return posix.normalize(posix.join(posix.dirname(from), specifier));
    if (specifier.startsWith('#')) return doors.get(`${from.split('/')[0]}:${specifier}`) ?? null;
    return doors.get(specifier) ?? null;
  };
}

// The names a part of the code reads: each name it writes past the key of a
// property and the name of a member, and a member of a name, `ns.name`, read
// as the member alone.
function namesRead(node, reads = new Set()) {
  if (node === null || typeof node !== 'object') return reads;
  if (Array.isArray(node)) {
    for (const child of node) namesRead(child, reads);
    return reads;
  }
  if (node.type === 'Identifier') reads.add(node.name);
  else if (node.type === 'MemberExpression') {
    if (node.object.type === 'Identifier' && !node.computed) reads.add(`${node.object.name}.${node.property.name}`);
    else namesRead(node.object, reads);
    if (node.computed) namesRead(node.property, reads);
  } else if (node.type === 'Property') {
    if (node.computed) namesRead(node.key, reads);
    namesRead(node.shorthand ? node.key : node.value, reads);
  } else for (const key in node) if (key !== 'loc') namesRead(node[key], reads);
  return reads;
}

const namesOfPattern = pattern => {
  switch (pattern?.type) {
    case 'Identifier': return [pattern.name];
    case 'ObjectPattern': return pattern.properties.flatMap(property => namesOfPattern(property.value ?? property.argument));
    case 'ArrayPattern': return pattern.elements.flatMap(namesOfPattern);
    case 'AssignmentPattern': return namesOfPattern(pattern.left);
    case 'RestElement': return namesOfPattern(pattern.argument);
    default: return [];
  }
};

// The imports a part of the code runs: the names it takes apart from
// `await import(…)`, a member it reads of one, and the module `require(…)`
// loads, whose exports its code writes as it loads.
function importsRun(node, resolve, path, found = []) {
  if (node === null || typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    for (const child of node) importsRun(child, resolve, path, found);
    return found;
  }
  const imported = expression => (expression?.type === 'AwaitExpression' && expression.argument.type === 'ImportExpression' ? resolve(path, expression.argument.source.value) : null);
  if (node.type === 'VariableDeclarator' && node.id.type === 'ObjectPattern' && imported(node.init) !== null) {
    for (const property of node.id.properties) found.push({ module: imported(node.init), name: property.key.name });
  } else if (node.type === 'MemberExpression' && !node.computed && imported(node.object) !== null) {
    found.push({ module: imported(node.object), name: node.property.name });
  } else if (node.type === 'CallExpression' && node.callee.name === 'require' && resolve(path, node.arguments[0]?.value) !== null) {
    found.push({ module: resolve(path, node.arguments[0].value), name: null });
  }
  for (const key in node) if (key !== 'loc') importsRun(node[key], resolve, path, found);
  return found;
}

// The code of the head of a script that reads its command line, which runs
// where the script is the command and no import runs.
const COMMAND_LINE = Symbol('commandLine');

// A module read into its parts: each declaration of its head with the lines
// it stands on, the names it declares, none for the code it runs as it
// loads, the names it reads and the imports it runs; the modules it loads; its
// imports, a name it imports by its name in the module and the name the other
// module exports, `*` for that module whole; and its exports, a local name or
// a name another module exports, and the modules whose exports it exports.
function moduleOf(path, text, resolve) {
  let program;
  try {
    program = parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });
  } catch {
    return null;
  }
  const module = { path, declarations: [], loads: new Set(), imports: new Map(), exports: new Map(), everything: [] };
  const declare = (names, node, read) => {
    module.declarations.push({ names, from: node.loc.start.line, to: node.loc.end.line, reads: namesRead(read), runs: importsRun(read, resolve, path) });
    return names;
  };
  const declared = (statement, written = statement) => {
    if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') return declare([statement.id.name], written, statement);
    if (statement.type === 'VariableDeclaration') return statement.declarations.flatMap(declarator => declare(namesOfPattern(declarator.id), written, declarator.init));
    return declare(namesRead(statement).has('process.argv') ? [COMMAND_LINE] : [], written, statement);
  };
  for (const statement of program.body) {
    const from = statement.source === undefined || statement.source === null ? null : resolve(path, statement.source.value);
    if (from !== null) module.loads.add(from);
    if (statement.type === 'ImportDeclaration') {
      for (const specifier of statement.specifiers) if (from !== null) module.imports.set(specifier.local.name, { module: from, name: specifier.type === 'ImportSpecifier' ? specifier.imported.name : '*' });
    } else if (statement.type === 'ExportAllDeclaration') {
      if (from !== null) module.everything.push(from);
    } else if (statement.type === 'ExportNamedDeclaration' && statement.source !== null) {
      for (const specifier of statement.specifiers) if (from !== null) module.exports.set(specifier.exported.name, { module: from, name: specifier.local.name });
    } else if (statement.type === 'ExportNamedDeclaration' && statement.declaration !== null) {
      for (const name of declared(statement.declaration, statement)) module.exports.set(name, { local: name });
    } else declared(statement);
  }
  return module;
}

// graphOfTree(root) → the modules of the tree by their paths.
export function graphOfTree(root) {
  const resolve = resolverOf(doorsOf(root));
  const modules = new Map();
  for (const path of execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n')) {
    if (!MODULE.test(path) || OUTSIDE.test(path)) continue;
    const module = moduleOf(path, readText(join(root, path)), resolve);
    if (module !== null) modules.set(path, module);
  }
  return modules;
}

// reachOf(modules, entry) → the declarations a module reaches as it loads,
// each `{ path, from, to }` by `<path>:<line>`: the code of every module its
// imports load, and each declaration a name read reaches, through the
// imports, the exports and the members of a module taken whole.
export function reachOf(modules, entry) {
  const reached = new Map();
  const loaded = new Set();
  const work = [];
  const take = (module, declaration) => {
    const key = `${module.path}:${declaration.from}`;
    if (reached.has(key)) return;
    reached.set(key, { path: module.path, from: declaration.from, to: declaration.to });
    work.push([module, declaration]);
  };
  const load = path => {
    const module = modules.get(path);
    if (module === undefined || loaded.has(path)) return;
    loaded.add(path);
    for (const declaration of module.declarations) if (declaration.names.length === 0) take(module, declaration);
    for (const next of module.loads) load(next);
  };
  const local = (module, name) => {
    for (const declaration of module.declarations) if (declaration.names.includes(name)) take(module, declaration);
  };
  const exported = (path, name, seen = new Set()) => {
    const module = modules.get(path);
    if (module === undefined || seen.has(`${path}:${name}`)) return;
    seen.add(`${path}:${name}`);
    load(path);
    if (name === '*') {
      for (const each of module.exports.keys()) exported(path, each, seen);
      for (const other of module.everything) exported(other, '*', seen);
      return;
    }
    const target = module.exports.get(name);
    if (target === undefined) for (const other of module.everything) exported(other, name, seen);
    else if (target.local !== undefined) local(module, target.local);
    else exported(target.module, target.name, seen);
  };
  const read = (module, name) => {
    const [head, member] = name.split('.');
    if (module.declarations.some(({ names }) => names.includes(head))) return local(module, head);
    const imported = module.imports.get(head);
    if (imported !== undefined) exported(imported.module, imported.name === '*' && member !== undefined ? member : imported.name);
  };
  load(entry);
  while (work.length > 0) {
    const [module, declaration] = work.pop();
    for (const name of declaration.reads) read(module, name);
    for (const { module: path, name } of declaration.runs) name === null ? load(path) : exported(path, name);
  }
  return reached;
}
