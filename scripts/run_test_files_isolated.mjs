import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

async function discoverTestFiles(root) {
  const files = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
        files.push(full);
      }
    }
  }
  await walk(root);
  return files;
}

function runFile(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--test", file], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });
  });
}

function parseTestCount(stdout) {
  const matches = [...stdout.matchAll(/^# tests\s+(\d+)\s*$/gm)];
  return matches.length ? Number(matches.at(-1)[1]) : 0;
}

const files = await discoverTestFiles(path.resolve("test"));
console.log(`discovered_test_files=${files.length}`);

let passFiles = 0;
let failFiles = 0;
let totalTests = 0;

for (const file of files) {
  const relative = path.relative(process.cwd(), file);
  const result = await runFile(relative);
  const tests = parseTestCount(result.stdout);
  totalTests += tests;
  if (result.code === 0 && !result.signal) {
    passFiles += 1;
    console.log(`PASS ${relative} tests=${tests}`);
    continue;
  }
  failFiles += 1;
  console.error(`FAIL ${relative} tests=${tests} code=${result.code ?? "null"} signal=${result.signal ?? "none"}`);
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

console.log(
  `file_isolated_summary pass_files=${passFiles} fail_files=${failFiles} total_tests=${totalTests}`,
);

if (failFiles > 0) process.exitCode = 1;
