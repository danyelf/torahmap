import { defineConfig } from 'vite';
import { execSync } from 'child_process';

// Get the current git branch name
function getGitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  define: {
    __GIT_BRANCH__: JSON.stringify(getGitBranch()),
  },
});
