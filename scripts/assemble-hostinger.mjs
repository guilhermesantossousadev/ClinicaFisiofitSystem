import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "apps/site/dist"), output, { recursive: true });
await mkdir(resolve(output, "sistema"), { recursive: true });
await cp(resolve(root, "apps/portal/dist"), resolve(output, "sistema"), { recursive: true });

console.log("Pacote Hostinger criado em dist/ com o portal em dist/sistema/.");
