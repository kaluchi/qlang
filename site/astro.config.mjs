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
  }
});
