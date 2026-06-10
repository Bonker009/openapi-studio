import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectNestedPackageNames,
  collectProductionDepNames,
  listHoistedDirectDeps,
  packageDirFor,
  pruneNestedNodeModules,
  resolveLiamCliVersion,
} from "../../scripts/stage-liam-cli-deps.mjs";

function writePkg(dir: string, name: string, deps: Record<string, string> = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name, version: "1.0.0", dependencies: deps })
  );
}

describe("stage-liam-cli-deps walker", () => {
  it("collects transitive production dependencies", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "liam-deps-"));
    const nm = path.join(root, "node_modules");
    writePkg(path.join(nm, "@liam-hq", "cli"), "@liam-hq/cli", {
      commander: "1.0.0",
      glob: "1.0.0",
    });
    writePkg(path.join(nm, "commander"), "commander");
    writePkg(path.join(nm, "glob"), "glob", { minimatch: "1.0.0" });
    writePkg(path.join(nm, "minimatch"), "minimatch");

    const names = collectProductionDepNames("@liam-hq/cli", nm).map((p) => p.name);
    assert.deepEqual(names, ["@liam-hq/cli", "commander", "glob", "minimatch"]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("resolves scoped package directories", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "liam-deps-"));
    const nm = path.join(root, "node_modules");
    writePkg(path.join(nm, "@liam-hq", "cli"), "@liam-hq/cli");
    const cliDir = path.join(nm, "@liam-hq", "cli");
    const dir = packageDirFor("@liam-hq/cli", nm);
    assert.equal(dir, cliDir);
    writePkg(path.join(cliDir, "node_modules", "commander"), "commander");
    const nested = packageDirFor("commander", nm, cliDir);
    assert.ok(nested?.includes("commander"));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("lists hoisted direct deps separately from nested", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "liam-hoist-"));
    const nm = path.join(root, "node_modules");
    const cliDir = path.join(nm, "@liam-hq", "cli");
    writePkg(cliDir, "@liam-hq/cli", { commander: "1.0.0", ink: "1.0.0" });
    writePkg(path.join(cliDir, "node_modules", "commander"), "commander");
    writePkg(path.join(nm, "ink"), "ink");

    const { hoisted } = listHoistedDirectDeps("@liam-hq/cli", nm);
    assert.deepEqual(hoisted, ["ink"]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("resolves @liam-hq/cli version from node_modules", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "liam-version-"));
    const nm = path.join(root, "node_modules");
    const cliDir = path.join(nm, "@liam-hq", "cli");
    fs.mkdirSync(cliDir, { recursive: true });
    fs.writeFileSync(
      path.join(cliDir, "package.json"),
      JSON.stringify({ name: "@liam-hq/cli", version: "9.9.9" })
    );
    assert.equal(resolveLiamCliVersion(nm), "9.9.9");
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("prunes nested node_modules after flat copy", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "liam-prune-"));
    const pkgRoot = path.join(root, "pkg");
    const nested = path.join(pkgRoot, "node_modules", "child");
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, "package.json"), "{}");
    pruneNestedNodeModules(root);
    assert.equal(fs.existsSync(nested), false);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("collects nested package names recursively", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "liam-nested-"));
    const cliDir = path.join(root, "cli");
    writePkg(path.join(cliDir, "node_modules", "glob"), "glob", { minimatch: "1.0.0" });
    writePkg(
      path.join(cliDir, "node_modules", "glob", "node_modules", "minimatch"),
      "minimatch"
    );
    const names = collectNestedPackageNames(cliDir);
    assert.ok(names.has("glob"));
    assert.ok(names.has("minimatch"));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("throws when a dependency is missing", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "liam-deps-"));
    const nm = path.join(root, "node_modules");
    writePkg(path.join(nm, "@liam-hq", "cli"), "@liam-hq/cli", {
      missing: "1.0.0",
    });
    assert.throws(() => collectProductionDepNames("@liam-hq/cli", nm), /Missing npm package/);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
