#!/usr/bin/env -S deno run --allow-all
await import("./lib/deploy-podman.ts");
await import("./lib/deploy-caddy.ts");
