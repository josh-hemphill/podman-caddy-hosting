#!/usr/bin/env -S deno run --allow-all
import * as log from "jsr:@std/log";
import { $ } from "jsr:@david/dax";
import { resolve } from "jsr:@std/path/resolve";
import { exists } from "jsr:@std/fs/exists";

const CADDY_SYSTEM_DOTENV = "/etc/caddy/.env";
const CADDYAPI_SYSTEMD_SERVICE = "/lib/systemd/system/caddy-api.service";

const caddyJson = await $`caddy adapt`.text();
const envKeys = [...String.prototype
  .matchAll.call(caddyJson, /\{env\.([\w_]+)}/g)]
  .map((match) => match[1]);
if (envKeys.length > 0) {
  log.info(
    "Runtime environment variables detected in Caddyfile, \
configuring systemd service w/ env file",
  );
  const localEnvFilePath = resolve(".env");
  const localEnvFile = await Deno.readTextFile(localEnvFilePath);

  for (const key of envKeys) {
    if (!localEnvFile.includes(key)) {
      log.error(
        `Caddyfile references env var ${key}, but not found in local .env file; exiting...`,
      );
      Deno.exit(1);
    }
  }

  let writeEnvFile = true;
  if (await exists(CADDY_SYSTEM_DOTENV)) {
    const systemEnvFile = await Deno.readTextFile(CADDY_SYSTEM_DOTENV);
    if (systemEnvFile === localEnvFile) {
      log.info("Caddy System .env file is already up-to-date");
      writeEnvFile = false;
    } else {
      log.info("Caddy System .env file is out-of-date, updating...");
    }
  }
  if (writeEnvFile) {
    await $`sudo tee ${CADDY_SYSTEM_DOTENV}`.stdinText(localEnvFile).quiet();
  }
}

const caddyApiService = await Deno.readTextFile(CADDYAPI_SYSTEMD_SERVICE);
if (!caddyApiService.includes("--envfile")) {
  log.info(
    "Configuring Caddy API systemd service to use system .env file (sym-linked to local .env)",
  );
  const updatedService = caddyApiService.replace(
    "ExecStart=/usr/bin/caddy run --environ --resume",
    `ExecStart=/usr/bin/caddy run --environ --resume --envfile ${CADDY_SYSTEM_DOTENV}`,
  );
  await $`sudo tee ${CADDYAPI_SYSTEMD_SERVICE} < ${updatedService}`.bytes();
  await $`sudo systemctl daemon-reload`;
}

const validation = await $`caddy validate`.lines();
if (validation.pop() !== "Valid configuration") {
  throw new Error("Invalid Caddyfile");
}

const caddyServiceStatus = await $`sudo systemctl is-active caddy-api`.text();
if (caddyServiceStatus !== "active") {
  await $`sudo systemctl restart caddy-api`;
}
await $`caddy reload`;
