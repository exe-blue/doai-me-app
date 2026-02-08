#!/usr/bin/env node
/**
 * Deploy script: commit all changes, push to origin.
 * Push to main triggers Vercel (or your CI) to deploy automatically.
 *
 * Usage:
 *   node scripts/deploy.mjs
 *   node scripts/deploy.mjs "fix: playbooks form"
 *   npm run deploy -- "your message"
 */

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const msg = process.argv[2] || "chore: deploy";

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", cwd: repoRoot, ...opts });
}

try {
  run("git add -A");
  const status = execSync("git status --porcelain", { encoding: "utf-8", cwd: repoRoot });
  if (!status.trim()) {
    console.log("Nothing to commit. Working tree clean.");
    process.exit(0);
  }
  run(`git commit -m ${JSON.stringify(msg)}`);
  run("git push");
  console.log("Pushed. Deployment will run automatically (e.g. Vercel on push to main).");
} catch (e) {
  const stderr = (e.stderr || e.message || "").toString();
  if (e.status === 128 && (/nothing to commit|no changes added/.test(stderr))) {
    console.log("Nothing to commit.");
    process.exit(0);
  }
  process.exit(e.status ?? 1);
}
