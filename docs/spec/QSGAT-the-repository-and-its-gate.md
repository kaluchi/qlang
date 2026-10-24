# QSGAT · The repository and its gate

The repository of the language and its tools: its workspaces, the order of
the imports of the core, the hosts beside the core, the gate that holds what
is pushed, and the release.

## workspaces

The language and its tooling are npm workspaces of one repository, each
folder the suffix of its package: `core` the language and `cli` the command
line and its REPL, published under the `@kaluchi/` scope, `lsp` the language
server, `site` the site, private, and `vscode` the editor's extension,
`qlang-vscode`; `npm install` at the root links them. The core is pure
JavaScript with no dependency at runtime and no `node:*` import under
`core/src/`, and it runs in a browser, in Deno and in Bun. Its catalog under
`core/lib/qlang/` is read at runtime as `#qlang/<name>`, and the topic of the
language, `core/lib/qlang.qlang`, as `#qlang`, through the `imports` of its
`package.json`, the loader of each platform chosen by the condition of
`#qlang/load-source`. The parser is built from `core/src/grammar.peggy` by
`npm run build`. A workspace depends on a sibling by the range `^x.y.z` of
the sibling's version, which `check:conventions` holds.

The core exports its root, `core/src/index.mjs`, beside `./errors`,
`./highlight`, the light door that loads the parser and its walks and no
runtime, and the sources of its catalog, each function of the package at one
door. The root re-exports by name from a module of the core what a workspace
beside it reads from the package or the page of the package,
`core/README.md`, writes, and `check:conventions` refuses any other export
of it. A script of the work takes `evalQuery` and `createNotebook` from the
root of the package.

## imports

The modules of `core/src` import in the order of the concepts, from the
bottom: the letters of a name, the address, the keys of the scope and the
declaration of a refusal; the values and their one order; the records of the
steps and the rules their constructors hold, which register nothing and
import no parser; the parser and the walks of its tree; the reading of a
path and the nearness of two names; the printer of the core's forms; the
parts of a doc; the state of a query, the table of primitives, the
resolution of names and the chain; the walk of a value's tags and the run of
a primitive; the evaluator; in `core/src/runtime/` the verbs, which register
their primitives as they load and `package.json#sideEffects` keeps, and the
root that boots them; and above them the notebook and the root of the
package. No module of the core imports a module that imports it, the parser
and the loaders among its imports, and none outside `runtime/` imports one
inside it but the notebook and the root of the package, which the tests of
this section hold by the strong components `scripts/core-imports.mjs`
computes. Each module is named for what it holds, by a name no other module
bears [QSLEX#grep], and the comment at its head marks the rules it holds
[QSREQ#marks].

## hosts

`cli/src/bin.mjs` is the one file of the command line that touches
`process`, handing the arguments, the streams and the environment to
`main.mjs` and exiting with the code `main` resolves, every branch of the
command line living where a test reaches it; the REPL paints what it prints
by a layer of colour over the core's `tokenize`. The test file of the
refusals of the command line, `cli/test/QSERR/site.test.mjs`, holds the page
of every refusal the core and the command line declare and of every one a
rule raises. The language server runs over stdio and answers `initialize`
with its capabilities; the editor's extension, `vscode/src/extension.js`,
unpublished, launches the server of the checkout. The site is built by
Astro, `site/astro.config.mjs`, its examples painted from what the core's
parser reads, and `.github/workflows/pages.yml` builds it and publishes it
to GitHub Pages on every push to master.

## gate

`npm run ci` is the gate of what is pushed, judged by its exit code, each
suite run once: the build, eslint, `check:conventions`, `check:probes`,
`check:fuzz`, `check:benchmark`, the suites of the core and of the command
line under the thresholds of coverage, a run of which fails a test that
fails as a run without it does, the suites of the language server, the site
and the extension, the integration of the command line and the build of the
site, in that order, the one run that boots the language while it runs. The
checks of GitHub, `.github/workflows/ci.yml`, run its steps but `check:fuzz`
and `check:benchmark` on every push to master and every pull request, the
job of the suites of the core and of the command line the job of their
coverage.

```sh
$ node -e "console.log(require('./package.json').scripts.ci.split(' && ').filter(step => /^npm (test|run test)/.test(step)).join('\n'))"
npm run test:coverage
npm test -w lsp -w site -w vscode
npm run test:integration
```

The thresholds of coverage, pinned in the `vitest.config.mjs` of `core` and
`cli`, hold the sources under the `src/` of both at a hundred on every axis,
the browser's loader and `cli/src/bin.mjs` aside. The setup of vitest in the
core, the command line and the language server registers an equality that
compares a value of the language by the tie of the one order, which reads
the tag a vector or a map holds on itself, leaving any other value to the
equality of vitest. Every suite of vitest fails a test that makes no
assertion, and in the core and the command line a test and a hook wait
twenty seconds, the boot of the root under the coverage among them.
`scripts/fuzz-laws.mjs` runs every law of the root again with its literals
changed to edge values, failing on a host's failure, a throw past the fail
track, or a print that reads back as another value. `check:conventions`
holds the rules each section names as held by it, the head of
`scripts/check-conventions.mjs` listing every one.

## release

`node scripts/release.mjs <version>` runs a release end to end from a clean
master in step with its remote whose checks on GitHub are green: a
preflight, the bump of the workspaces the matrix of
`.github/workflows/deploy.yml` publishes, the ranges, the parser, the
coverage of the core and the tests, the commit, the push, the wait for the
checks, the tag and its push. The tag runs that workflow, which publishes the
core and the command line through the trusted publishing of npm, whose
publisher names that file; the commit of a release lands on master directly.
A release happens at the maintainer's word, and between releases the sister
project consumes the copy of the workspace.
