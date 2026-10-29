// The surface of the root of the package against what a host builds on: the
// names the root exports and each module it re-exports them from, read by the
// parser of JavaScript the scripts read a module by; the names a host reads from the
// package by an import, a re-export, a namespace or a dynamic import; and the
// names the page of the package writes [QSGAT#workspaces].

import { parse } from 'acorn';

const parsed = text => parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });

// The code of a source: an Astro page's frontmatter, any other source whole.
export const codeOf = (path, text) => (path.endsWith('.astro') ? /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '' : text);

function visit(node, parents, visitor) {
  visitor(node, parents);
  for (const child of Object.values(node)) {
    for (const held of Array.isArray(child) ? child : [child]) {
      if (typeof held?.type === 'string') visit(held, [node, ...parents], visitor);
    }
  }
}

// exportsOf(text) → the names a module exports by name from another module,
// each with that module, and the lines of every other export it makes.
export function exportsOf(text) {
  const named = [];
  const otherwise = [];
  for (const node of parsed(text).body) {
    if (node.type === 'ExportNamedDeclaration' && node.source !== null) named.push(...node.specifiers.map(({ exported }) => ({ name: exported.name, from: node.source.value })));
    else if (node.type.startsWith('Export')) otherwise.push(node.loc.start.line);
  }
  return { named, otherwise };
}

// The names an object a binding takes apart names, every name where it keeps
// the rest.
const namesTakenApart = binding => (binding?.type === 'ObjectPattern'
  ? binding.properties.map(property => (property.type === 'RestElement' ? '*' : property.key.name))
  : []);

// namesReadFrom(packageName, text) → the names a source reads from a package
// by the names the package exports them under: an import and a re-export,
// an alias aside, the members a namespace of it reads, and the names a
// dynamic import destructures, `*` for a source that reads every name.
export function namesReadFrom(packageName, text) {
  const read = new Set();
  if (!text.includes(packageName)) return read;
  const namespaces = new Set();
  const fromThePackage = node => node.source?.type === 'Literal' && node.source.value === packageName;
  const ast = parsed(text);
  visit(ast, [], (node, [first, second]) => {
    if ((node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration') && fromThePackage(node)) {
      for (const specifier of node.specifiers) {
        if (specifier.type === 'ImportNamespaceSpecifier') namespaces.add(specifier.local.name);
        else read.add(specifier.type === 'ImportSpecifier' ? specifier.imported.name : specifier.local.name);
      }
    } else if (node.type === 'ExportAllDeclaration' && fromThePackage(node)) {
      read.add('*');
    } else if (node.type === 'ImportExpression' && fromThePackage(node)) {
      const taken = first?.type === 'MemberExpression' && first.property.name === 'then' && second?.type === 'CallExpression' ? second.arguments[0]?.params?.[0]
        : first?.type === 'AwaitExpression' && second?.type === 'VariableDeclarator' ? second.id : null;
      if (taken?.type === 'Identifier') namespaces.add(taken.name);
      else namesTakenApart(taken).forEach(name => read.add(name));
    }
  });
  visit(ast, [], node => {
    if (node.type === 'MemberExpression' && !node.computed && node.object.type === 'Identifier' && namespaces.has(node.object.name)) read.add(node.property.name);
  });
  return read;
}

// namesWrittenBy(page) → the names a page of markdown writes in backquotes.
export const namesWrittenBy = page => new Set([...page.matchAll(/`([A-Za-z_$][\w$]*)/g)].map(([, name]) => name));

// unreadExports({ rootText, doorModules, read, written }) → what the root of
// the package exports beyond what a host builds on: an export made otherwise
// than by name from a module, a name re-exported from the module another
// door opens, and a name no host reads and the page does not write.
export function unreadExports({ rootText, doorModules, read, written }) {
  const { named, otherwise } = exportsOf(rootText);
  return [
    ...otherwise.map(line => ({ line, problem: 'exports otherwise than by name from a module of the core' })),
    ...named.filter(({ from }) => doorModules.has(from)).map(({ name, from }) => ({ name, problem: `is re-exported from ${from}, which a door of its own opens` })),
    ...named.filter(({ name }) => !read.has('*') && !read.has(name) && !written.has(name)).map(({ name }) => ({ name, problem: 'is read by no host and written by no page of the package' }))
  ];
}
