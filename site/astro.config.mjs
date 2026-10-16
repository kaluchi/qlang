// The decisions it exists for: [QSWRK#tooling].

import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://kaluchi.github.io',
  base: '/qlang',
  vite: {
    // Keep `@kaluchi/qlang-core` out of every server-side bundle so
    // that `load-source-node.mjs::loadSource` sees its native module
    // URL when calling `createRequire(import.meta.url).resolve(
    // '#qlang')`. Inlined into a server chunk, the
    // `import.meta.url` rewrite points inside `site/dist`, whose
    // surrounding `package.json` has no `#qlang` entry —
    // `package.json#imports` resolves from the importing module's own
    // package, not from the bundling host's package.
    //
    // Astro renders the pages in its `prerender` environment and the
    // server entry in `ssr`; each environment carries its own resolve
    // config, so both name the externalised package.
    environments: {
      prerender: { resolve: { external: ['@kaluchi/qlang-core'] } },
      ssr: { resolve: { external: ['@kaluchi/qlang-core'] } }
    }
  }
});
