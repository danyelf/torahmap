import { defineConfig, type Plugin } from "vite";
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

/**
 * Vite plugin: send HMR event when story.md changes in public/data/.
 * The app listens for this to hot-reload the story without a full page refresh.
 */
function storyHotReload(): Plugin {
  return {
    name: "story-hot-reload",
    configureServer(server) {
      server.watcher.add(resolve(__dirname, "public/data/story.md"));
      server.watcher.on("change", (file) => {
        if (file.endsWith("story.md")) {
          server.ws.send({ type: "custom", event: "story-update" });
        }
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  // Use /torahmap/ base path only for production build
  base: command === "build" ? "/torahmap/" : "/",
  define: {
    __GIT_BRANCH__: JSON.stringify(getGitBranch()),
  },
  plugins: [storyHotReload()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        "test-harness": resolve(__dirname, "test-harness/index.html"),
        talmud: resolve(__dirname, "talmud.html"),
      },
    },
  },
}));
