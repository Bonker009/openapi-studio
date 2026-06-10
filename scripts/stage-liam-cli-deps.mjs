#!/usr/bin/env node
/**
 * Copy @liam-hq/cli and its production dependency tree into OUT_DIR
 * for Next.js standalone Docker images (subprocess deps are not file-traced).
 *
 * Uses an isolated `npm install --omit=dev` so peer deps and nested layouts
 * match a real install (flat-copy walkers miss hoisted peers and versions).
 *
 * Usage: node scripts/stage-liam-cli-deps.mjs [outDir]
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const NODE_MODULES = path.join(ROOT, "node_modules");
const ENTRY = "@liam-hq/cli";
const OUT_DIR = path.resolve(process.argv[2] ?? "/opt/externals");

function dirForPackageName(name, parentDir) {
  if (name.startsWith("@")) {
    const [scope, pkg] = name.split("/");
    if (!scope || !pkg) return null;
    return path.join(parentDir, scope, pkg);
  }
  return path.join(parentDir, name);
}

export function packageDirFor(name, nodeModulesRoot = NODE_MODULES, parentPkgDir = null) {
  const candidates = [];
  if (parentPkgDir) {
    candidates.push(path.join(parentPkgDir, "node_modules"));
  }
  candidates.push(nodeModulesRoot);

  for (const root of candidates) {
    const dir = dirForPackageName(name, root);
    if (dir && fs.existsSync(dir)) return dir;
  }
  return null;
}

export function readPackageJson(pkgDir) {
  const file = path.join(pkgDir, "package.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** BFS collect production + required peer dependency packages. */
export function collectProductionDepNames(entryName, nodeModulesRoot = NODE_MODULES, parentPkgDir = null) {
  const queue = [{ name: entryName, parentDir: parentPkgDir }];
  const seen = new Set();
  const ordered = [];

  while (queue.length) {
    const { name, parentDir } = queue.shift();
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const dir = packageDirFor(name, nodeModulesRoot, parentDir);
    if (!dir) {
      throw new Error(
        `Missing npm package: ${name} (searched from ${nodeModulesRoot}${parentDir ? ` near ${parentDir}` : ""})`
      );
    }

    ordered.push({ name, dir });
    const pkg = readPackageJson(dir);
    const deps = { ...(pkg?.dependencies ?? {}) };
    const peerDeps = pkg?.peerDependencies ?? {};
    const peerMeta = pkg?.peerDependenciesMeta ?? {};
    for (const [dep, range] of Object.entries(peerDeps)) {
      if (peerMeta[dep]?.optional) continue;
      deps[dep] = range;
    }
    for (const dep of Object.keys(deps)) {
      if (!seen.has(dep)) {
        queue.push({ name: dep, parentDir: dir });
      }
    }
  }

  return ordered;
}

/** All package names installed under a package's node_modules tree. */
export function collectNestedPackageNames(pkgDir) {
  const names = new Set();
  const nm = path.join(pkgDir, "node_modules");
  if (!fs.existsSync(nm)) return names;

  function walk(nmDir) {
    for (const entry of fs.readdirSync(nmDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === ".bin") continue;
      if (entry.name.startsWith("@")) {
        const scopePath = path.join(nmDir, entry.name);
        for (const pkg of fs.readdirSync(scopePath, { withFileTypes: true })) {
          if (!pkg.isDirectory()) continue;
          names.add(`${entry.name}/${pkg.name}`);
          const nested = path.join(scopePath, pkg.name, "node_modules");
          if (fs.existsSync(nested)) walk(nested);
        }
      } else {
        names.add(entry.name);
        const nested = path.join(nmDir, entry.name, "node_modules");
        if (fs.existsSync(nested)) walk(nested);
      }
    }
  }

  walk(nm);
  return names;
}

/** Direct deps of entry that npm hoists outside entry/node_modules. */
export function listHoistedDirectDeps(entryName, nodeModulesRoot = NODE_MODULES) {
  const entryDir = packageDirFor(entryName, nodeModulesRoot);
  if (!entryDir) {
    throw new Error(`Missing npm package: ${entryName}`);
  }
  const pkg = readPackageJson(entryDir);
  const deps = pkg?.dependencies ?? {};
  const hoisted = [];
  const nestedRoot = path.join(entryDir, "node_modules");

  for (const dep of Object.keys(deps)) {
    const dir = packageDirFor(dep, nodeModulesRoot, entryDir);
    if (!dir || dir.startsWith(nestedRoot + path.sep)) continue;
    hoisted.push(dep);
  }

  return { entryDir, hoisted };
}

/** @deprecated Kept for unit tests; staging uses npm install instead. */
export function pruneNestedNodeModules(outDir) {
  if (!fs.existsSync(outDir)) return;
  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("@")) {
      const scopePath = path.join(outDir, entry.name);
      for (const pkg of fs.readdirSync(scopePath, { withFileTypes: true })) {
        if (!pkg.isDirectory()) continue;
        const nested = path.join(scopePath, pkg.name, "node_modules");
        if (fs.existsSync(nested)) {
          fs.rmSync(nested, { recursive: true, force: true });
        }
      }
    } else {
      const nested = path.join(outDir, entry.name, "node_modules");
      if (fs.existsSync(nested)) {
        fs.rmSync(nested, { recursive: true, force: true });
      }
    }
  }
}

export function resolveLiamCliVersion(nodeModulesRoot = NODE_MODULES) {
  const entryDir = packageDirFor(ENTRY, nodeModulesRoot);
  if (!entryDir) {
    throw new Error(`Missing npm package: ${ENTRY}`);
  }
  const pkg = readPackageJson(entryDir);
  if (!pkg?.version) {
    throw new Error(`@liam-hq/cli package.json has no version`);
  }
  return pkg.version;
}

/** Install @liam-hq/cli into an isolated tree and copy node_modules to outDir. */
export function stageLiamCliPackages(nodeModulesRoot = NODE_MODULES, outDir = OUT_DIR) {
  const version = resolveLiamCliVersion(nodeModulesRoot);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "liam-cli-bundle-"));
  const bundlePkg = {
    name: "liam-cli-bundle",
    private: true,
    dependencies: {
      [ENTRY]: version,
    },
  };

  try {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(bundlePkg, null, 2));
    execSync("npm install --omit=dev --ignore-scripts --no-audit --no-fund --prefer-offline", {
      cwd: tmpDir,
      stdio: "pipe",
      env: { ...process.env, NODE_ENV: "production" },
    });

    const stagedNm = path.join(tmpDir, "node_modules");
    if (!fs.existsSync(stagedNm)) {
      throw new Error("npm install did not create node_modules");
    }

    fs.mkdirSync(outDir, { recursive: true });
    for (const entry of fs.readdirSync(stagedNm)) {
      const src = path.join(stagedNm, entry);
      const dest = path.join(outDir, entry);
      fs.cpSync(src, dest, { recursive: true, force: true });
    }

    const count = collectProductionDepNames(ENTRY, stagedNm).length;
    return { count, version, hoisted: listHoistedDirectDeps(ENTRY, stagedNm).hoisted };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function main() {
  const { count, version } = stageLiamCliPackages(NODE_MODULES, OUT_DIR);
  console.log(`Staged ${count} packages for ${ENTRY}@${version} -> ${OUT_DIR}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
