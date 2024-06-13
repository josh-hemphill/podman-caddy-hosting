#!/usr/bin/env -S deno run --allow-all
import { $ } from "jsr:@david/dax";

$`podman kube play --replace --start=false \
--annotation hosting=services ./.bin/services.kube.yaml`;
