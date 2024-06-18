#!/usr/bin/env -S deno run --allow-all
import { $ } from "jsr:@david/dax";
import * as log from "jsr:@std/log";
import {
  parseAll as parseAllYaml,
  stringify as stringifyYaml,
} from "jsr:@std/yaml";

const deploymentYaml = await Deno.readTextFile(".bin/services.kube.yaml");
const deployment = parseAllYaml(deploymentYaml) as TemplateKubeYaml[];

log.info("Deploying services...");
for (const pod of deployment) {
  log.info(`Creating pod ${pod.metadata.name}...`);
  const nsFlag = pod.metadata.annotations?.["io.podman.annotations.userns"];
  if (nsFlag === "keep-id") {
    await $`podman kube play --replace --no-hosts --userns=keep-id --start=false \
  --annotation hosting=services -`.stdinText(stringifyYaml(pod));
  } else {
    await $`podman kube play --replace --no-hosts --start=false \
  --annotation hosting=services -`.stdinText(stringifyYaml(pod));
  }
}

log.info(
  "Podman kube play successfully build out all pods/containers/volumes!",
);
const confirmStart = confirm("Start all services?");
if (confirmStart) {
  for (const pod of deployment) {
    log.info(`Starting pod ${pod.metadata.name}...`);
    await $`podman pod start ${pod.metadata.name}`;
  }
}
