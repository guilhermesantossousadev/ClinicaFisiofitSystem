import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) throw new Error(`Missing ${name}`);
  return args[index + 1];
};
const dist = resolve(option("--dist"));
const output = resolve(option("--output"));
const candidate = option("--candidate");
if (!/^[0-9a-f]{40}$/.test(candidate)) throw new Error("Candidate must be a full commit SHA.");
if (output === dist || output.startsWith(`${dist}${sep}`)) throw new Error("Manifest must be outside dist.");

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = [];
async function walk(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!prefix && entry.name === ".git") continue;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlink in distribution: ${path}`);
    if (entry.isDirectory()) await walk(resolve(directory, entry.name), path);
    else if (entry.isFile()) {
      const target = resolve(dist, path);
      const relativePath = relative(dist, target);
      if (isAbsolute(relativePath) || relativePath.startsWith("..")) throw new Error(`Unsafe path: ${path}`);
      const bytes = await readFile(target);
      const info = await stat(target);
      if (info.size !== bytes.length) throw new Error(`File changed while hashing: ${path}`);
      if (/\.(js|css)$/.test(path) && /^\s*<!doctype\s+html/i.test(bytes.toString("utf8", 0, 256))) {
        throw new Error(`HTML found in asset: ${path}`);
      }
      files.push({ path, bytes: bytes.length, sha256: digest(bytes) });
    } else throw new Error(`Unsupported distribution entry: ${path}`);
  }
}
await walk(dist);
files.sort((a, b) => a.path.localeCompare(b.path));
for (const path of [".htaccess", "index.html", "sistema/.htaccess", "sistema/index.html"]) {
  if (!files.some((file) => file.path === path)) throw new Error(`Missing distribution file: ${path}`);
}
const compatibility = JSON.parse(await readFile(resolve(root, "release/hostinger/v22-compat-manifest.json"), "utf8"));
for (const asset of compatibility.files) {
  const file = files.find((item) => item.path === asset.path);
  if (!file || file.bytes !== asset.bytes || file.sha256 !== asset.sha256) {
    throw new Error(`V2.2 compatibility asset changed: ${asset.path}`);
  }
}
await writeFile(output, `${JSON.stringify({ candidate, files }, null, 2)}\n`);
console.log(`PASS hostinger-manifest files=${files.length} candidate=${candidate}`);
