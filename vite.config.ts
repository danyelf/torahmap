import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import { resolve } from 'path';

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

export default defineConfig({
  define: {
    __GIT_BRANCH__: JSON.stringify(getGitBranch()),
  },
  build: {
    // Only the Tanakh map is published. The dev server still serves talmud.html
    // and the test harness, since it serves any HTML file it is asked for.
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') },
    },
  },
});
