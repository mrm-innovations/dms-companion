import { rm, mkdir, readFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const distDir = resolve(rootDir, "dist");
const releaseDir = resolve(rootDir, "release");
const packageJsonPath = resolve(rootDir, "package.json");
const manifestPath = resolve(distDir, "manifest.json");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const assertExists = async (path, label) => {
  try {
    await access(path, fsConstants.R_OK);
  } catch {
    throw new Error(`${label} not found: ${path}`);
  }
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
};

await assertExists(distDir, "dist directory");
await assertExists(manifestPath, "dist manifest");

const packageJson = await readJson(packageJsonPath);
const manifest = await readJson(manifestPath);

if (packageJson.version !== manifest.version) {
  throw new Error(
    `Version mismatch: package.json is ${packageJson.version}, manifest is ${manifest.version}`,
  );
}

const allowedHostPermissions = new Set([
  "https://dms.dilg.gov.ph/*",
  "https://divops.vercel.app/*",
  "http://localhost:3000/*",
]);

if (!manifest.host_permissions?.every((permission) => allowedHostPermissions.has(permission))) {
  throw new Error(
    "Manifest host_permissions must be limited to DMS and configured tracker origins",
  );
}

if (!manifest.content_scripts?.every((script) =>
  script.matches?.every((match) => match === "https://dms.dilg.gov.ph/*"),
)) {
  throw new Error("Manifest content script matches must be limited to https://dms.dilg.gov.ph/*");
}

await mkdir(releaseDir, { recursive: true });

const zipPath = resolve(releaseDir, `dms-companion-${packageJson.version}.zip`);
await rm(zipPath, { force: true });

if (process.platform === "win32") {
  run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force`,
  ]);
} else {
  run("zip", ["-r", zipPath, "."], { cwd: distDir });
}

console.log(`Created ${zipPath}`);
