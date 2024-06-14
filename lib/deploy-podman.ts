#!/usr/bin/env -S deno run --allow-all
import { $ } from "jsr:@david/dax";
import * as log from "jsr:@std/log";
import { parseAll as parseYaml } from "jsr:@std/yaml";

await $`podman kube play --replace --no-hosts --userns=keep-id --start=false \
--annotation hosting=services ./.bin/services.kube.yaml`;

log.info(
  "Podman kube play successfully build out all pods/containers/volumes!",
);
const confirmStart = confirm("Start all services?");
if (confirmStart) {
  const deploymentYaml = await Deno.readTextFile(".bin/services.kube.yaml");
  const deployment = parseYaml(deploymentYaml) as TemplateKubeYaml[];
  for (const pod of deployment) {
    log.info(`Starting pod ${pod.metadata.name}...`);
    await $`podman pod start ${pod.metadata.name}`;
  }
}
