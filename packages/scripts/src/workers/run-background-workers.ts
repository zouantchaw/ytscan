import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../../../");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

type WorkerDefinition = {
  args: string[];
  enabled: () => boolean;
  name: string;
};

type ChildState = {
  definition: WorkerDefinition;
  process: ChildProcess | null;
  restartTimer: NodeJS.Timeout | null;
};

const childStates = new Map<string, ChildState>();
let shuttingDown = false;

const workerDefinitions: WorkerDefinition[] = [
  {
    name: "scan",
    args: ["run", "scan:run"],
    enabled: () => true,
  },
  {
    name: "media",
    args: ["run", "media:run"],
    enabled: () => true,
  },
];

function log(workerName: string, message: string): void {
  process.stdout.write(`[worker:${workerName}] ${message}\n`);
}

function logError(workerName: string, message: string): void {
  process.stderr.write(`[worker:${workerName}] ${message}\n`);
}

function clearRestartTimer(state: ChildState): void {
  if (!state.restartTimer) return;
  clearTimeout(state.restartTimer);
  state.restartTimer = null;
}

function prefixOutput(workerName: string, chunk: Buffer | string, writer: NodeJS.WriteStream): void {
  const text = chunk.toString();
  const normalized = text.endsWith("\n") ? text.slice(0, -1) : text;
  if (!normalized) return;

  for (const line of normalized.split("\n")) {
    writer.write(`[worker:${workerName}] ${line}\n`);
  }
}

function scheduleRestart(state: ChildState): void {
  clearRestartTimer(state);
  if (shuttingDown) return;

  state.restartTimer = setTimeout(() => {
    state.restartTimer = null;
    spawnWorker(state);
  }, 5000);
}

function stopChild(state: ChildState): void {
  clearRestartTimer(state);
  if (!state.process) return;
  state.process.kill("SIGTERM");
  state.process = null;
}

function spawnWorker(state: ChildState): void {
  if (!state.definition.enabled()) {
    log(state.definition.name, "Disabled by environment. Skipping startup.");
    return;
  }

  const child = spawn(npmCommand, state.definition.args, {
    cwd: MONOREPO_ROOT,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  state.process = child;
  log(state.definition.name, `Started ${npmCommand} ${state.definition.args.join(" ")}`);

  child.stdout.on("data", (chunk) => prefixOutput(state.definition.name, chunk, process.stdout));
  child.stderr.on("data", (chunk) => prefixOutput(state.definition.name, chunk, process.stderr));
  child.on("error", (error) => {
    logError(state.definition.name, error instanceof Error ? error.message : String(error));
  });

  child.on("close", (code, signal) => {
    state.process = null;

    if (shuttingDown) {
      log(state.definition.name, `Stopped during shutdown (${signal ?? code ?? "unknown"}).`);
      return;
    }

    const reason = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
    logError(state.definition.name, `Exited with ${reason}. Restarting in 5s.`);
    scheduleRestart(state);
  });
}

function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log("supervisor", "Shutting down background workers.");

  for (const state of childStates.values()) {
    stopChild(state);
  }

  setTimeout(() => process.exit(0), 250).unref();
}

for (const definition of workerDefinitions) {
  childStates.set(definition.name, {
    definition,
    process: null,
    restartTimer: null,
  });
}

for (const state of childStates.values()) {
  spawnWorker(state);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
