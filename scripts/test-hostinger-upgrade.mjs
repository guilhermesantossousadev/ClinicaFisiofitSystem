import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) throw new Error(`Required option missing: ${name}`);
  return args[index + 1];
};
const previousRoot = resolve(option("--previous"));
const candidateRoot = resolve(option("--candidate"));
const previousManifest = JSON.parse(await readFile(resolve(option("--previous-manifest")), "utf8"));
const candidateManifest = JSON.parse(await readFile(resolve(option("--candidate-manifest")), "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const types = new Map([[".css", "text/css"], [".html", "text/html"], [".js", "application/javascript"]]);

function expected(manifest, path) {
  const file = manifest.files.find((entry) => entry.path === path);
  assert.ok(file, `Manifest contains ${path}`);
  return file;
}
function safeResolve(directory, path) {
  assert.ok(!isAbsolute(path) && !path.split(/[\\/]/).includes(".."), `Safe path ${path}`);
  const target = resolve(directory, path);
  const fromRoot = relative(directory, target);
  assert.ok(fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot));
  return target;
}

let activeRoot = previousRoot;
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    let path = pathname.replace(/^\/+/, "");
    if (!path) path = "index.html";
    else if (path === "sistema" || path === "sistema/") path = "sistema/index.html";
    else if (path.endsWith("/")) path += "index.html";
    let diskPath = safeResolve(activeRoot, path);
    try {
      const info = await stat(diskPath);
      if (info.isDirectory()) diskPath = safeResolve(activeRoot, `${path}/index.html`);
    } catch {
      if (pathname.startsWith("/sistema/")) diskPath = safeResolve(activeRoot, "sistema/index.html");
      else throw new Error("not found");
    }
    const bytes = await readFile(diskPath);
    response.writeHead(200, { "content-type": `${types.get(extname(diskPath).toLowerCase()) ?? "application/octet-stream"}; charset=utf-8`, "x-content-type-options": "nosniff" });
    response.end(bytes);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
  }
});
await new Promise((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(0, "127.0.0.1", resolveListen);
});

async function getVerifiedAsset(baseUrl, manifest, path) {
  const file = expected(manifest, path);
  const response = await fetch(`${baseUrl}/${path}?transition=${Math.random()}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, `${path} status`);
  const expectedType = types.get(extname(path).toLowerCase());
  if (expectedType) assert.equal(response.headers.get("content-type")?.split(";")[0], expectedType, `${path} MIME`);
  assert.equal(bytes.length, file.bytes, `${path} size`);
  assert.equal(digest(bytes), file.sha256, `${path} SHA-256`);
  return bytes;
}

try {
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  await getVerifiedAsset(baseUrl, previousManifest, "sistema/index.html");
  const previousAssets = previousManifest.files.filter((file) => /^(sistema\/)?assets\/.*\.(js|css)$/.test(file.path));
  for (const file of previousAssets) await getVerifiedAsset(baseUrl, previousManifest, file.path);

  activeRoot = candidateRoot;
  for (const file of previousAssets) {
    const retained = expected(candidateManifest, file.path);
    assert.equal(retained.sha256, file.sha256, `${file.path} retained unchanged`);
    await getVerifiedAsset(baseUrl, previousManifest, file.path);
  }
  const html = (await getVerifiedAsset(baseUrl, candidateManifest, "sistema/index.html")).toString("utf8");
  const entry = html.match(/src="([^"]+\.js)"/)?.[1]?.replace(/^\//, "");
  const css = html.match(/href="([^"]+\.css)"/)?.[1]?.replace(/^\//, "");
  assert.ok(entry && css, "New portal shell references its JavaScript and CSS");
  await getVerifiedAsset(baseUrl, candidateManifest, entry);
  await getVerifiedAsset(baseUrl, candidateManifest, css);
  const route = await fetch(`${baseUrl}/sistema/matriculas/historico`);
  assert.equal(digest(Buffer.from(await route.arrayBuffer())), expected(candidateManifest, "sistema/index.html").sha256);
  console.log(`PASS upgrade-http retained-assets=${previousAssets.length} new-session=2 route=1`);
} finally {
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
}
