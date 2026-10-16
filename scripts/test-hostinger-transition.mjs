import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) throw new Error(`Required option missing: ${name}`);
  return resolve(args[index + 1]);
};
const v22Root = option("--v22");
const v23Root = option("--v23");
const v22Manifest = JSON.parse(await readFile(resolve(root, "release/hostinger/v22-rollback-manifest.json"), "utf8"));
const v23Manifest = JSON.parse(await readFile(resolve(root, "release/hostinger/v23-approved-manifest.json"), "utf8"));
const compatManifest = JSON.parse(await readFile(resolve(root, "release/hostinger/v22-compat-manifest.json"), "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const types = new Map([[".css", "text/css"], [".html", "text/html"], [".js", "application/javascript"]]);

function expectedFile(manifest, path) {
  const file = manifest.files.find((entry) => entry.path === path);
  assert.ok(file, `manifest contains ${path}`);
  return file;
}

function safeResolve(directory, path) {
  assert.ok(!isAbsolute(path) && !path.split(/[\\/]/).includes(".."), `safe path ${path}`);
  const target = resolve(directory, path);
  const fromRoot = relative(directory, target);
  assert.ok(fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot), `path remains within ${directory}`);
  return target;
}

let activeRoot = v22Root;
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
    const type = types.get(extname(diskPath).toLowerCase()) ?? "application/octet-stream";
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

async function getVerifiedAsset(baseUrl, manifest, path) {
  const expected = expectedFile(manifest, path);
  const response = await fetch(`${baseUrl}/${path}?transition=${Math.random()}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, `${path} status`);
  assert.equal(response.headers.get("content-type")?.split(";")[0], types.get(extname(path).toLowerCase()), `${path} MIME`);
  assert.equal(bytes.length, expected.bytes, `${path} byte count`);
  assert.equal(digest(bytes), expected.sha256, `${path} SHA-256`);
  if ([".js", ".css"].includes(extname(path).toLowerCase())) {
    assert.ok(!/^\s*<!doctype\s+html/i.test(bytes.toString("utf8", 0, 256)), `${path} is not HTML fallback`);
  }
  return bytes;
}

try {
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const v22Html = (await getVerifiedAsset(baseUrl, v22Manifest, "sistema/index.html")).toString("utf8");
  const oldEntry = v22Manifest.files.find((file) => file.path.endsWith("/index-CNUCljKP.js"));
  const oldCss = v22Manifest.files.find((file) => file.path.endsWith("/index-BeexdN4s.css"));
  assert.ok(v22Html.includes(oldEntry.path.replace(/^sistema/, "/sistema")), "old tab bootstraps the V2.2 entry script");
  assert.ok(v22Html.includes(oldCss.path.replace(/^sistema/, "/sistema")), "old tab bootstraps the V2.2 stylesheet");
  await getVerifiedAsset(baseUrl, v22Manifest, oldEntry.path);
  await getVerifiedAsset(baseUrl, v22Manifest, oldCss.path);

  // Keep the V2.2 document/entry loaded in the simulated tab; switch only the server's release root.
  activeRoot = v23Root;
  for (const asset of compatManifest.files) await getVerifiedAsset(baseUrl, v23Manifest, asset.path);

  // A new tab now receives the V2.3 shell, entry and stylesheet from the same server.
  const v23Html = (await getVerifiedAsset(baseUrl, v23Manifest, "sistema/index.html")).toString("utf8");
  const newEntryPath = v23Html.match(/src="([^"]+\.js)"/)?.[1]?.replace(/^\//, "");
  const newCssPath = v23Html.match(/href="([^"]+\.css)"/)?.[1]?.replace(/^\//, "");
  assert.ok(newEntryPath, "V2.3 shell references a new JavaScript entry");
  assert.ok(newCssPath, "V2.3 shell references a new stylesheet");
  await getVerifiedAsset(baseUrl, v23Manifest, newEntryPath);
  await getVerifiedAsset(baseUrl, v23Manifest, newCssPath);

  const route = await fetch(`${baseUrl}/sistema/matriculas/historico`);
  const routeBytes = Buffer.from(await route.arrayBuffer());
  assert.equal(route.status, 200, "V2.3 direct route status");
  assert.equal(digest(routeBytes), expectedFile(v23Manifest, "sistema/index.html").sha256, "V2.3 SPA route shell");

  console.log("PASS transition-http v22-tab-held v22-late-chunks=5 v23-new-session=2 route=1");
} finally {
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
}
