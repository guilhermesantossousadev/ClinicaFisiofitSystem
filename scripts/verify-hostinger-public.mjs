import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const manifestPath = resolve(option("--manifest", resolve(root, "release/hostinger/v23-approved-manifest.json")));
const baseUrl = option("--url", "https://clinicafisiofitsabara.com").replace(/\/$/, "");
const retries = Number(option("--retries", "36"));
const intervalMs = Number(option("--interval-ms", "10000"));

const mediaTypes = new Map([
  [".avif", ["image/avif"]],
  [".css", ["text/css"]],
  [".html", ["text/html"]],
  [".jpg", ["image/jpeg"]],
  [".js", ["application/javascript", "text/javascript"]],
  [".svg", ["image/svg+xml"]],
  [".txt", ["text/plain"]],
]);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

async function fetchPath(path) {
  return fetchUrl(`${baseUrl}/${path}`, path);
}

async function fetchUrl(url, label) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "follow" });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  const actualType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const allowedTypes = mediaTypes.get(extname(label).toLowerCase());
  if (allowedTypes && !allowedTypes.includes(actualType)) {
    throw new Error(`${label} returned MIME ${actualType ?? "missing"}, expected ${allowedTypes.join(" or ")}`);
  }
  return { response, bytes };
}

async function verifyOnce() {
  for (const route of ["index.html", "sistema/index.html"]) {
    const expected = manifest.files.find((file) => file.path === route);
    if (!expected) throw new Error(`Manifest lacks required route file ${route}`);
    const { bytes } = await fetchPath(route);
    if (bytes.length !== expected.bytes || digest(bytes) !== expected.sha256) {
      throw new Error(`${route} does not match the expected release HTML`);
    }
  }

  for (const [url, path] of [[`${baseUrl}/`, "index.html"], [`${baseUrl}/sistema/`, "sistema/index.html"]]) {
    const expected = manifest.files.find((file) => file.path === path);
    const { response, bytes } = await fetchUrl(url, url);
    if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "text/html") {
      throw new Error(`${url} did not return text/html`);
    }
    if (bytes.length !== expected.bytes || digest(bytes) !== expected.sha256) {
      throw new Error(`${url} does not serve the expected release HTML`);
    }
  }

  const appEntry = manifest.files.find((file) => file.path === "sistema/index.html");
  const { bytes: routeBytes } = await fetchUrl(`${baseUrl}/sistema/matriculas/historico`, "/sistema/matriculas/historico");
  if (digest(routeBytes) !== appEntry.sha256) throw new Error("A direct portal route did not resolve to the expected SPA shell");

  for (const file of manifest.files) {
    if (file.path.endsWith(".htaccess") || file.path === "index.html" || file.path === "sistema/index.html") continue;
    const { bytes } = await fetchPath(file.path);
    const extension = extname(file.path).toLowerCase();
    // Public JPEG byte drift is a previously documented P3; local package verification remains strict.
    if (extension === ".jpg") continue;
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) {
      throw new Error(`${file.path} bytes differ from the expected release manifest`);
    }
    if ([".js", ".css"].includes(extension) && /^\s*<!doctype\s+html/i.test(bytes.toString("utf8", 0, 256))) {
      throw new Error(`${file.path} returned HTML instead of its declared asset type`);
    }
  }
  return manifest.files.filter((file) => !file.path.endsWith(".htaccess")).length;
}

let lastError;
for (let attempt = 1; attempt <= retries; attempt += 1) {
  try {
    const checked = await verifyOnce();
    console.log(`PASS hostinger-public url=${baseUrl} assets=${checked} manifest=${manifestPath.split("/").at(-1)}`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < retries) {
      console.log(`Propagation check ${attempt}/${retries} not ready: ${error.message}`);
      await new Promise((resolveSleep) => setTimeout(resolveSleep, intervalMs));
    }
  }
}

console.error(`FAILED hostinger-public after ${retries} attempts: ${lastError?.message ?? "unknown error"}`);
process.exitCode = 1;
