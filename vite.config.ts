import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'child_process';
import { basename, resolve } from 'path';

// Get the current git branch name
function getGitBranch(): string {
  // Set by Cloudflare builds, whose checkout need not be on a named branch.
  if (process.env.WORKERS_CI_BRANCH) return process.env.WORKERS_CI_BRANCH;
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Vite plugin: send HMR event when a story in public/data/stories/ changes.
 * The app listens for this to hot-reload the story without a full page refresh.
 */
function storyHotReload(): Plugin {
  const dir = resolve(__dirname, 'public/data/stories');
  return {
    name: 'story-hot-reload',
    configureServer(server) {
      server.watcher.add(dir);
      server.watcher.on('change', (file) => {
        if (file.startsWith(dir) && file.endsWith('.md')) {
          server.ws.send({
            type: 'custom',
            event: 'story-update',
            data: { id: basename(file, '.md') },
          });
        }
      });
    },
  };
}

export default defineConfig({
  define: {
    __GIT_BRANCH__: JSON.stringify(getGitBranch()),
  },
  plugins: [storyHotReload()],
  build: {
    // Only the Tanakh map is published. The dev server still serves talmud.html
    // and the test harness, since it serves any HTML file it is asked for.
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') },
    },
  },
});
