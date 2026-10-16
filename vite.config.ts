import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

import fs from 'fs';

function githubPagesPlugin() {
  return {
    name: 'github-pages-plugin',
    closeBundle() {
      const distDir = path.resolve('dist');
      const docsDir = path.resolve('docs');
      const indexPath = path.join(distDir, 'index.html');
      const notFoundPath = path.join(distDir, '404.html');
      const noJekyllPath = path.join(distDir, '.nojekyll');

      if (fs.existsSync(indexPath)) {
        try {
          fs.copyFileSync(indexPath, notFoundPath);
          fs.writeFileSync(noJekyllPath, '');
          if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir, { recursive: true });
          }
          fs.cpSync(distDir, docsDir, { recursive: true });
        } catch (e) {
          console.warn('githubPagesPlugin copy warning:', e);
        }
      }
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), githubPagesPlugin()],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
