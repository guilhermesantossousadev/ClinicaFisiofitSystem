import { copyFile, cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "apps/site/dist"), output, { recursive: true });
await mkdir(resolve(output, "sistema"), { recursive: true });
await cp(resolve(root, "apps/portal/dist"), resolve(output, "sistema"), { recursive: true });

const compatibility = JSON.parse(await readFile(resolve(root, "release/hostinger/v22-compat-manifest.json"), "utf8"));
const compatibilityRoot = resolve(root, "release/hostinger/v22-compat");

for (const asset of compatibility.files) {
  if (isAbsolute(asset.path) || asset.path.split(/[\\/]/).includes("..")) {
    throw new Error(`Invalid compatibility asset path: ${asset.path}`);
  }

  const source = resolve(root, asset.source);
  const sourceRelative = relative(compatibilityRoot, source);
  if (sourceRelative === ".." || sourceRelative.startsWith(`..${sep}`) || isAbsolute(sourceRelative)) {
    throw new Error(`Compatibility source is outside its approved directory: ${asset.source}`);
  }

  const sourceInfo = await stat(source);
  const sourceHash = createHash("sha256").update(await readFile(source)).digest("hex");
  if (!sourceInfo.isFile() || sourceInfo.size !== asset.bytes || sourceHash !== asset.sha256) {
    throw new Error(`Compatibility source does not match approved V2.2 bytes: ${asset.path}`);
  }

  const target = resolve(output, asset.path);
  const targetRelative = relative(output, target);
  if (targetRelative === ".." || targetRelative.startsWith(`..${sep}`) || isAbsolute(targetRelative)) {
    throw new Error(`Compatibility target is outside dist: ${asset.path}`);
  }

  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target, 1);
}

console.log(`Pacote Hostinger criado em dist/ com o portal e ${compatibility.files.length} chunks V2.2 preservados em dist/sistema/assets/.`);
