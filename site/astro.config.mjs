import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  integrations: [mdx()],
  site: 'https://kaluchi.github.io',
  base: '/qlang',
  markdown: {
    shikiConfig: {
      themes: {
        light: 'min-light',
        dark: 'github-dark'
      }
    }
  },
  vite: {
    // Keep `@kaluchi/qlang-core` out of every server-side bundle so
    // that `load-source-node.mjs::loadSource` sees its native module
    // URL when calling `createRequire(import.meta.url).resolve(
    // '#qlang/core')`. Inlined into a server chunk, the
    // `import.meta.url` rewrite points inside `site/dist`, whose
    // surrounding `package.json` has no `#qlang/core` entry —
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
