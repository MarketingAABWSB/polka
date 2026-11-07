import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../polka-studio/", import.meta.url));
const normalizePath = (value) => {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

// Windows cannot replace native modules loaded by the development server.
// Check before npm touches the app's dependency directory.
let devServer;
try {
  devServer = JSON.parse(readFileSync(path.join(appRoot, ".vinext/dev/lock.json"), "utf8"));
} catch { /* A missing or stale lock does not prevent installation. */ }

if (Number.isInteger(devServer?.pid) && devServer.pid > 0 &&
    typeof devServer.cwd === "string" && normalizePath(devServer.cwd) === normalizePath(appRoot)) {
  let running = false;
  try { process.kill(devServer.pid, 0); running = true; }
  catch (error) { running = error.code === "EPERM"; }
  if (running) {
    console.error("Stop the photobooth dev server with Ctrl+C in its terminal, then run npm install again. The app's dependencies have not been changed.");
    process.exit(1);
  }
}

if (!process.env.npm_execpath) {
  console.error("Run npm install from the photobooth folder.");
  process.exit(1);
}

// Repair missing packages without the destructive child `npm ci` step.
const result = spawnSync(process.execPath, [
  process.env.npm_execpath, "install", "--prefix", appRoot, "--workspaces=false",
  "--include=dev", "--include=optional", "--prefer-offline", "--no-audit", "--no-fund",
], { cwd: appRoot, stdio: "inherit" });

if (result.error) {
  console.error(`Unable to install app dependencies: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
