import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const v23Manifest = JSON.parse(await readFile(resolve(root, "release/hostinger/v23-approved-manifest.json"), "utf8"));
const compatManifest = JSON.parse(await readFile(resolve(root, "release/hostinger/v22-compat-manifest.json"), "utf8"));
const compatRoot = resolve(root, "release/hostinger/v22-compat");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const mimeFor = (path) => ({
  ".css": "text/css",
  ".js": "application/javascript",
}[extname(path).toLowerCase()] ?? null);

test("approved V2.3 manifest identifies the exact sealed candidate and 26 files", () => {
  assert.equal(v23Manifest.candidate, "5bf7a5c5a02432dc5f32d0ec7397607f051feb87");
  assert.equal(v23Manifest.archiveSha256, "93e0a18a161f62cd30425e750b376fe0c919b695607d25e454b8e92815658af7");
  assert.equal(v23Manifest.files.length, 26);
  assert.equal(new Set(v23Manifest.files.map((file) => file.path)).size, 26);
});

test("five repository compatibility files preserve the V2.2 rollback archive bytes", async () => {
  assert.equal(compatManifest.sourceArchiveSha256, "3935d76592d2eba2e2090416ea6aaf45b8a6e29e81c7ea92412f27cad8b7da80");
  assert.equal(compatManifest.files.length, 5);
  const expectedFiles = [];

  for (const asset of compatManifest.files) {
    const sourcePath = resolve(root, asset.source);
    assert.ok(sourcePath.startsWith(`${compatRoot}/`), `${asset.source} stays under the approved compatibility source directory`);
    const bytes = await readFile(sourcePath);
    const info = await stat(sourcePath);
    const approved = v23Manifest.files.find((file) => file.path === asset.path);
    assert.ok(approved, `${asset.path} is in the sealed V2.3 package`);
    assert.equal(info.size, asset.bytes, `${asset.path} byte count`);
    assert.equal(sha256(bytes), asset.sha256, `${asset.path} SHA-256`);
    assert.equal(asset.bytes, approved.bytes, `${asset.path} agrees with the package size`);
    assert.equal(asset.sha256, approved.sha256, `${asset.path} agrees with the package SHA-256`);
    assert.equal(mimeFor(asset.path), asset.mimeType, `${asset.path} MIME type`);
    assert.ok(asset.origin.includes("Verified V2.2 rollback archive"), `${asset.path} records its source`);
    expectedFiles.push(sourcePath);
  }

  const actualFiles = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile()) actualFiles.push(entryPath);
      else assert.fail(`Unexpected compatibility source entry: ${entryPath}`);
    }
  };
  await visit(compatRoot);
  assert.deepEqual(actualFiles.sort(), expectedFiles.sort(), "only the five approved chunks are committed; no old HTML or config is copied");
});

test("V2.2 entry and lazy chunks retain their declared module dependencies", async () => {
  for (const asset of compatManifest.files) {
    if (asset.mimeType !== "application/javascript") continue;
    const bytes = await readFile(resolve(root, asset.source), "utf8");
    for (const dependency of asset.dependencies) {
      assert.ok(bytes.includes(dependency.split("/").at(-1)), `${asset.path} references ${dependency}`);
    }
  }
  assert.ok(compatManifest.files.every((asset) => Array.isArray(asset.dependencies)));
});

test("compatibility chunks do not collide with V2.3-owned paths", () => {
  const v22Paths = new Set(compatManifest.files.map((asset) => asset.path));
  const newV23Files = v23Manifest.files.filter((file) => !v22Paths.has(file.path));
  assert.equal(newV23Files.length, 21);
  assert.equal(new Set(newV23Files.map((file) => file.path)).size, newV23Files.length);
  assert.equal(v23Manifest.files.filter((file) => v22Paths.has(file.path)).length, 5);
});
