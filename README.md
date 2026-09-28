# qlang

Reference implementation of the qlang pipeline query language. Monorepo
of the language core plus tooling workspaces.

```
qlang/                  ← this repo
├── core/               @kaluchi/qlang-core   — language core, pure JS, zero runtime deps
├── cli/                @kaluchi/qlang-cli    — command line and REPL, `qlang` and `ql`
├── lsp/                @kaluchi/qlang-lsp    — language server
├── site/               @kaluchi/qlang-site   — Astro documentation site (private)
├── vscode/             qlang-vscode          — VS Code Marketplace package
├── docs/               the audit, the entrypoint design, the decisions
├── scripts/            release.mjs           — release orchestration
└── package.json        npm workspaces shell
```

The folder name maps to the suffix of the npm package name; the npm
scope is always `@kaluchi/`. Single rule, applied uniformly across
every workspace.

## Quick start

```
npm install                              # symlinks every workspace via npm workspaces
npm run build                            # generate the parser from core/src/grammar.peggy
npm test                                 # run every workspace's test suite
npm run ci                               # every gate a push must pass
```

## Documentation

The language documents itself: `qlang '::qlang | doc'` opens the root
page, whose links lead to every concept, kind and verb, each page a doc
whose laws run. A host embedding the core reads
[core/README.md](core/README.md).

## Releasing

```
node scripts/release.mjs <version>
```

Bumps every workspace and the sibling ranges, rebuilds, runs the tests,
commits, pushes, waits for CI and tags; the Deploy workflow publishes
from the pushed tag to npm and creates the GitHub Release.

## License

Apache-2.0 — see [LICENSE](LICENSE).
