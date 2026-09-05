#!/usr/bin/env node
// Minimal stdio JSON-RPC 2.0 client for the 21st.dev Magic MCP server.
//
// Usage:
//   node audit/mcp-call.mjs list
//   node audit/mcp-call.mjs call <toolName> '<json arguments>'
//
// Uses only Node built-ins (child_process, readline). Never prints env vars
// or any secret material — the server subprocess inherits the environment
// but this script does not read or log it.

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const SERVER_CMD = "/home/ubuntu/.local/bin/magic-mcp";
const TIMEOUT_MS = 120_000;

function usageAndExit() {
  console.error(
    "Usage:\n  node audit/mcp-call.mjs list\n  node audit/mcp-call.mjs call <toolName> '<json arguments>'"
  );
  process.exit(1);
}

async function main() {
  const [mode, toolName, argsJson] = process.argv.slice(2);
  if (mode !== "list" && mode !== "call") usageAndExit();
  if (mode === "call" && !toolName) usageAndExit();

  let toolArgs = {};
  if (mode === "call" && argsJson !== undefined) {
    try {
      toolArgs = JSON.parse(argsJson);
    } catch (err) {
      console.error(`Invalid JSON arguments: ${err.message}`);
      process.exit(1);
    }
  }

  const child = spawn(SERVER_CMD, [], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let settled = false;
  let stderrBuf = "";
  const pending = new Map(); // id -> {resolve, reject}
  let nextId = 1;

  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    child.kill("SIGKILL");
    console.error(`Timed out after ${TIMEOUT_MS}ms waiting on MCP server.`);
    process.exit(1);
  }, TIMEOUT_MS);
  timer.unref?.();

  function cleanupAndExit(code) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    try {
      child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
    process.exit(code);
  }

  child.on("error", (err) => {
    console.error(`Failed to start MCP server: ${err.message}`);
    cleanupAndExit(1);
  });

  child.stderr.on("data", (chunk) => {
    stderrBuf += chunk.toString("utf8");
  });

  child.on("exit", (code, signal) => {
    if (settled) return;
    // Server exited before we got our answer.
    settled = true;
    clearTimeout(timer);
    const tail = stderrBuf.trim().split("\n").slice(-20).join("\n");
    console.error(
      `MCP server exited early (code=${code}, signal=${signal}).` +
        (tail ? `\nstderr:\n${tail}` : "")
    );
    process.exit(1);
  });

  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });

  function send(obj) {
    child.stdin.write(JSON.stringify(obj) + "\n");
  }

  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      send({ jsonrpc: "2.0", id, method, params });
    });
  }

  function notify(method, params) {
    send({ jsonrpc: "2.0", method, params });
  }

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      // Not JSON (e.g. stray log line on stdout) — ignore.
      return;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(JSON.stringify(msg.error)));
      } else {
        resolve(msg.result);
      }
    }
  });

  try {
    await request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "audit-cli", version: "0.1" },
    });
    notify("notifications/initialized", {});

    let output;
    if (mode === "list") {
      output = await request("tools/list", {});
    } else {
      output = await request("tools/call", {
        name: toolName,
        arguments: toolArgs,
      });
    }

    console.log(JSON.stringify(output, null, 2));
    cleanupAndExit(0);
  } catch (err) {
    console.error(`MCP call failed: ${err.message}`);
    cleanupAndExit(1);
  }
}

main();
