import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDirectory, "..");
const shimTargets = [
  path.join(appRoot, ".next", "types", "routes.js"),
  path.join(appRoot, ".next", "dev", "types", "routes.js"),
];

async function ensureShim(filePath) {
  try {
    await access(filePath);
    return;
  } catch {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "export {};\n", "utf8");
  }
}

await Promise.all(shimTargets.map(ensureShim));
