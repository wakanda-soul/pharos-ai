#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mcpPath = path.resolve(__dirname, "../src/mcp-server.ts");

const child = spawn("npx", ["--yes", "tsx", mcpPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
