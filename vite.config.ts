import { defineConfig } from "vite";
import { execSync } from "child_process";
import { resolve } from "path";

// Get the current git branch name
function getGitBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig(({ command }) => ({
  // Use /torahmap/ base path only for production build
  base: command === "build" ? "/torahmap/" : "/",
  define: {
    __GIT_BRANCH__: JSON.stringify(getGitBranch()),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        "test-harness": resolve(__dirname, "test-harness/index.html"),
      },
    },
  },
}));
