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
    ssr: {
      // Keep `@kaluchi/qlang-core` out of the SSR bundle so that
      // `load-source-node.mjs::loadSource` sees its native module
      // URL when calling `createRequire(import.meta.url).resolve(
      // '#qlang/core')`. Inlined into the page bundle, the
      // `import.meta.url` rewrite would point at
      // `site/dist/pages/index.astro.mjs` whose surrounding
      // `package.json` has no `#qlang/core` entry — `package.json
      // #imports` resolves from the importing module's own
      // package, not from the bundling host's package.
      external: ['@kaluchi/qlang-core']
    }
  }
});
