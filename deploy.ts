#!/usr/bin/env -S deno run --allow-all
import { $ } from "jsr:@david/dax";

const selection = await $.multiSelect({
  message: "Deploy Podman containers And/Or Caddy Proxy config:",
  options: [{ text: "Podman Containers", selected: true }, {
    text: "Caddy Proxy",
    selected: true,
  }],
});

if (selection.includes(0)) {
  await import("./lib/deploy-podman.ts");
}
if (selection.includes(1)) {
  await import("./lib/deploy-caddy.ts");
}
