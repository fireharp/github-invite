import { readFileSync, writeFileSync } from "node:fs";

const required = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_ZONE_NAME",
  "INVITE_KV_NAMESPACE_ID",
  "WORKER_HOSTNAME",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required deploy env vars: ${missing.join(", ")}`);
  process.exit(1);
}

let config = readFileSync("wrangler.template.jsonc", "utf8");
for (const name of required) {
  config = config.replaceAll(`<${name}>`, process.env[name]);
}

writeFileSync("wrangler.generated.jsonc", config);
