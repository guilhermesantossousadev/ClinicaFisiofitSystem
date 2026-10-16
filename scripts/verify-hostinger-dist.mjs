import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const dist = resolve(option("--dist", resolve(root, "dist")));
const manifestPath = resolve(option("--manifest", resolve(root, "release/hostinger/v23-approved-manifest.json")));
const verifyHttp = args.includes("--http");

const mediaTypes = new Map([
  [".avif", "image/avif"],
  [".css", "text/css"],
  [".html", "text/html"],
  [".jpg", "image/jpeg"],
  [".js", "application/javascript"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain"],
]);

function mediaType(path) {
  return mediaTypes.get(extname(path).toLowerCase()) ?? "text/plain";
}

function safePath(base, path) {
  if (!path || isAbsolute(path) || path.split(/[\\/]/).includes("..")) {
    throw new Error(`Invalid relative path in manifest: ${path}`);
  }
  const target = resolve(base, path);
  const targetRelative = relative(base, target);
  if (targetRelative === ".." || targetRelative.startsWith(`..${sep}`) || isAbsolute(targetRelative)) {
    throw new Error(`Path escapes root: ${path}`);
  }
  return target;
}

async function walkFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in dist: ${path}`);
    if (entry.isDirectory()) files.push(...await walkFiles(resolve(directory, entry.name), path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unsupported dist entry: ${path}`);
  }
  return files;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const isV23 = manifest.candidate === "5bf7a5c5a02432dc5f32d0ec7397607f051feb87";
if (isV23 && manifest.files?.length !== 26) {
  throw new Error("Approved V2.3 manifest must contain 26 files (21 V2.3 build files plus 5 retained V2.2 chunks).");
}
if (!isV23 && manifest.sourceCommit !== "f256de6369f98567fabaf9139658c6de8e4af517") {
  throw new Error(`Unsupported distribution manifest: ${manifestPath}`);
}
if (!Array.isArray(manifest.files) || (isV23 && manifest.files.length !== 26) || (!isV23 && manifest.files.length !== 21)) {
  throw new Error(`Unexpected file count in distribution manifest: ${manifest.files?.length}`);
}

const compat = isV23
  ? JSON.parse(await readFile(resolve(root, "release/hostinger/v22-compat-manifest.json"), "utf8"))
  : { files: [] };
const expected = new Map(manifest.files.map((file) => [file.path, file]));
if (expected.size !== manifest.files.length) throw new Error("Duplicate paths in approved V2.3 manifest.");
if (isV23 && compat.files.length !== 5) throw new Error("V2.2 compatibility manifest must contain exactly five files.");

for (const asset of compat.files) {
  const approved = expected.get(asset.path);
  if (!approved || approved.bytes !== asset.bytes || approved.sha256 !== asset.sha256) {
    throw new Error(`Compatibility asset does not match the sealed V2.3 package manifest: ${asset.path}`);
  }
  if (mediaType(asset.path) !== asset.mimeType) throw new Error(`Incorrect MIME metadata for ${asset.path}`);
}

const actualPaths = (await walkFiles(dist)).sort();
const expectedPaths = [...expected.keys()].sort();
const missing = expectedPaths.filter((path) => !actualPaths.includes(path));
const extra = actualPaths.filter((path) => !expected.has(path));
if (missing.length || extra.length) {
  throw new Error(`Distribution file set mismatch. Missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}`);
}

for (const file of manifest.files) {
  const path = safePath(dist, file.path);
  const info = await stat(path);
  const bytes = await readFile(path);
  if (!info.isFile() || info.size !== file.bytes || digest(bytes) !== file.sha256) {
    throw new Error(`Size or SHA-256 mismatch: ${file.path}`);
  }
  if ([".js", ".css"].includes(extname(file.path).toLowerCase()) && /^\s*<!doctype\s+html/i.test(bytes.toString("utf8", 0, 256))) {
    throw new Error(`HTML was found where a JavaScript/CSS asset is expected: ${file.path}`);
  }
}

if (verifyHttp) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(url.pathname);
      let relativePath = pathname.replace(/^\/+/, "");
      if (!relativePath || relativePath === "sistema") relativePath = relativePath ? "sistema/index.html" : "index.html";
      if (relativePath.endsWith("/")) relativePath += "index.html";
      let filePath = safePath(dist, relativePath);
      try {
        const info = await stat(filePath);
        if (info.isDirectory()) filePath = safePath(dist, `${relativePath}/index.html`);
      } catch {
        if (pathname.startsWith("/sistema/")) filePath = safePath(dist, "sistema/index.html");
        else throw new Error("not found");
      }
      const bytes = await readFile(filePath);
      const type = mediaType(relative(dist, filePath).split(sep).join("/"));
      response.writeHead(200, { "content-type": `${type}; charset=utf-8`, "x-content-type-options": "nosniff" });
      response.end(bytes);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
    }
  });

  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const routes = ["/", "/sistema/", "/sistema/matriculas/historico"];
    for (const route of routes) {
      const response = await fetch(`${baseUrl}${route}`);
      if (!response.ok) throw new Error(`Route ${route} returned HTTP ${response.status}`);
      const body = Buffer.from(await response.arrayBuffer());
      const expectedHtml = route === "/" ? expected.get("index.html") : expected.get("sistema/index.html");
      if (digest(body) !== expectedHtml.sha256 || response.headers.get("content-type")?.split(";")[0] !== "text/html") {
        throw new Error(`Route ${route} did not serve the approved HTML document.`);
      }
    }

    for (const file of manifest.files.filter((entry) => !entry.path.endsWith(".htaccess"))) {
      const response = await fetch(`${baseUrl}/${file.path}`);
      const body = Buffer.from(await response.arrayBuffer());
      if (response.status !== 200) throw new Error(`${file.path} returned HTTP ${response.status}`);
      if (response.headers.get("content-type")?.split(";")[0] !== mediaType(file.path)) {
        throw new Error(`Incorrect HTTP MIME type for ${file.path}: ${response.headers.get("content-type")}`);
      }
      if (body.length !== file.bytes || digest(body) !== file.sha256) throw new Error(`HTTP bytes differ from approved manifest: ${file.path}`);
      if ([".js", ".css"].includes(extname(file.path).toLowerCase()) && /^\s*<!doctype\s+html/i.test(body.toString("utf8", 0, 256))) {
        throw new Error(`HTTP returned HTML for ${file.path}`);
      }
    }
  } finally {
    await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  }
}

console.log(`PASS hostinger-dist files=${manifest.files.length} v22Compatibility=${compat.files.length} http=${verifyHttp ? "passed" : "not-requested"}`);
