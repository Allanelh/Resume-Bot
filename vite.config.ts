import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, readdirSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';

const copyPublicPlugin = () => ({
  name: 'copy-public-filtered',
  apply: 'build' as const,
  closeBundle() {
    const publicDir = 'public';
    const outDir = 'dist';

    try {
      const files = readdirSync(publicDir);
      files.forEach(file => {
        if (file === '.gitkeep') return;
        if (file.includes('copy') && file !== 'image copy copy copy copy copy copy copy.png') return;

        try {
          const srcPath = join(publicDir, file);
          const destPath = join(outDir, file);
          const stat = statSync(srcPath);

          if (stat.isFile()) {
            copyFileSync(srcPath, destPath);
          }
        } catch (e) {
          console.log(`Skipping ${file}`);
        }
      });
    } catch (e) {
      // Silent fail
    }
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyPublicPlugin()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  publicDir: false,
});
