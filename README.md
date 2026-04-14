# qlang

Reference implementation of the qlang pipeline query language. Monorepo
of the language core plus tooling workspaces.

```
qlang/                  ← this repo
├── core/               @kaluchi/qlang-core   — language core, pure JS, zero runtime deps
├── lsp/                @kaluchi/qlang-lsp    — language server
├── site/               @kaluchi/qlang-site   — Astro documentation site (private)
├── vscode/             qlang-vscode          — VS Code Marketplace package
├── docs/               qlang-spec.md, qlang-operands.md, qlang-internals.md
├── scripts/            release.mjs           — release orchestration
└── package.json        npm workspaces shell
```

The folder name maps to the suffix of the npm package name; the npm
scope is always `@kaluchi/`. Single rule, applied uniformly across
every workspace.

## Quick start

```
npm install                              # symlinks every workspace via npm workspaces
npm run build                            # generate parser + core catalog (core workspace)
npm test                                 # run every workspace's test suite
npm run test:coverage                    # verify 100/100/100/100 thresholds on the core
```

Per workspace:

```
npm test         -w @kaluchi/qlang-core
npm test         -w @kaluchi/qlang-lsp
npm test         -w @kaluchi/qlang-site
npm run build    -w @kaluchi/qlang-core
```

## Documentation

| Audience | Doc |
|---|---|
| query authors | [docs/qlang-spec.md](docs/qlang-spec.md) — values, pipeline, conduits, scoping, grammar |
| query authors | [docs/qlang-operands.md](docs/qlang-operands.md) — full catalog of built-in operands |
| evaluator implementors | [docs/qlang-internals.md](docs/qlang-internals.md) — formal `(pipeValue, env)` model, AST, codec |

## Releasing

```
node scripts/release.mjs <version>
```

Bumps `@kaluchi/qlang-core`, rebuilds, runs every workspace test, tags,
and pushes. The Deploy workflow takes over from the pushed tag —
publishes to npm and creates the GitHub Release.

## License

Apache-2.0 — see [LICENSE](LICENSE).
