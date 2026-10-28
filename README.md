# qlang

Reference implementation of the qlang pipeline query language. Monorepo
of the language core plus tooling workspaces.

```
qlang/                  ← this repo
├── core/               @kaluchi/qlang-core   — language core, pure JS, zero runtime deps
├── stdio/              @kaluchi/qlang-stdio  — the streams a host on the command line installs, `::stdio`
├── playground/         @kaluchi/qlang-playground — the playground of the command line, `qplay`, and its REPL, a demo
├── lsp/                @kaluchi/qlang-lsp    — language server
├── site/               @kaluchi/qlang-site   — Astro site, private: a landing page and a playground
├── vscode/             qlang-vscode          — editor extension, unpublished, running the language server of the checkout
├── docs/               spec/ what holds · journal/ the aim, the records of the change and the research
├── scripts/            release.mjs and the scripts of the work
└── package.json        npm workspaces shell
```

The folder name maps to the suffix of the npm package name, under the
npm scope `@kaluchi/` for every workspace but the editor extension.

## Quick start

```
npm install                              # symlinks every workspace via npm workspaces
npm run build                            # generate the parser from core/src/grammar.peggy
npm test                                 # run every workspace's test suite
npm run ci                               # every gate a push must pass
```

## Documentation

The language documents itself: `qplay '::qlang | doc'` opens the first
page, whose links lead to every concept, kind and verb, each page a doc
whose laws run. A host embedding the core reads
[core/README.md](core/README.md).

## Releasing

```
node scripts/release.mjs <version>
```

Bumps the core and the command line and the sibling ranges, rebuilds,
runs the tests,
commits, pushes, waits for CI and tags; the Deploy workflow publishes
from the pushed tag to npm and creates the GitHub Release.

## License

Apache-2.0 — see [LICENSE](LICENSE).
