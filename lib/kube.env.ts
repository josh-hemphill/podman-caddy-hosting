#!/usr/bin/env -S deno run --allow-all
import { Eta } from "https://deno.land/x/eta@v3.0.3/src/index.ts";
import { parse as parseYaml, stringify as stringifyYaml } from "jsr:@std/yaml";
import { parse as parseEnv } from "jsr:@std/dotenv/parse";
import { join } from "jsr:@std/path/posix/join";
import { ensureDir, ensureFile, exists } from "jsr:@std/fs";
import * as log from "jsr:@std/log";
import $ from "jsr:@david/dax";

const SERVICES_YAML_NAME = ".bin/services.kube.yaml";
const DERIVED_CADDY_NAME = ".bin/derived.caddy";

const render = (template: string, data: object) =>
  new Eta({
    varName: "env",
    tags: ["{{", "}}"],
  }).renderString(template, data);

const pods: Map<string, string> = new Map();
const srvRecords: Map<
  string,
  { domains: string[]; port: number }
> = new Map();
const uniqueDomains = new Set<string>();
const uniquePorts = new Set<number>();

const cwd = Deno.cwd();
const servicesDir = join(cwd, "services");
let services: { dir: Deno.DirEntry; envPath: string; yamlPath: string }[] = [];
for await (const dir of Deno.readDir(servicesDir)) {
  const envPath = join(servicesDir, dir.name, ".env");
  const yamlPath = join(servicesDir, dir.name, "template.kube.yaml");
  if (
    dir.isDirectory &&
    await exists(envPath) &&
    await exists(yamlPath)
  ) {
    services.push({ dir, envPath, yamlPath });
  }
}

const includeServices = await $.multiSelect({
  message: "Select services to include:",
  options: services.map(({ dir }) => ({ text: dir.name, selected: true })),
});
services = services.filter((_name, i) => includeServices.includes(i));

for (const { dir, envPath, yamlPath } of services) {
  const envText = await Deno.readTextFile(envPath);
  const yamlTemplateText = await Deno.readTextFile(yamlPath);
  const envWContext = `SERVICE_DIR='${join(servicesDir, dir.name)}'
SERVICE_NAME='${dir.name}'
${envText}`;
  const env = parseEnv(envWContext);

  const yamlObj = parseYaml(render(yamlTemplateText, env), {
    filename: yamlPath,
  }) as TemplateKubeYaml;

  const domain = env.DOMAIN;
  const port = yamlObj.spec.containers.find((c) => c?.ports?.[0].hostPort)
    ?.ports?.[0].hostPort;

  if (!port) {
    log.error(`No backend port found for ${dir.name}; exiting...`);
    Deno.exit(1);
  }
  if (!domain) {
    log.error(`No backend domain found for ${dir.name}; exiting...`);
    Deno.exit(1);
  }

  const addOrError = <T extends string | number>(
    list: Set<T>,
    key: T,
    listName: string = "",
  ) => {
    if (list.has(key)) {
      log.error(`Duplicate key (${listName}): ${key}; exiting...`);
      Deno.exit(1);
    }
    list.add(key);
  };
  addOrError(uniqueDomains, domain, "domains");
  addOrError(uniquePorts, port, "ports");

  const domains = [domain];
  for (const domainAlias of env?.DOMAIN_ALIASES?.split(",") ?? []) {
    addOrError(uniqueDomains, domainAlias, "domainAliases");
    domains.push(domainAlias);
  }

  for (const volume of yamlObj.spec.volumes) {
    if (volume.hostPath) {
      const { type, path } = volume.hostPath;
      if (type === "Directory") {
        ensureDir(path);
      } else if (type === "File") {
        exists(path) || ensureFile(path);
        if (
          path.includes("password") && Deno.readTextFileSync(path).length < 2
        ) {
          log.warn(`Empty password file: ${path}`);
        }
      } else {
        log.error(`Unsupported volume type: ${type}; continuing...`);
      }
    }
  }

  for (
    const [key, value] of Object.entries(env).filter((v) =>
      v[0].startsWith("EXT_")
    )
  ) {
    const realKey = key.slice(4);
    for (const container of yamlObj.spec.containers) {
      if (container.env) {
        container.env.push({ name: realKey, value: value });
      }
    }
  }

  srvRecords.set(dir.name, { domains, port });
  pods.set(dir.name, stringifyYaml(yamlObj));
}

const servicesYamlText = [...pods.values()].join("---\n");

const servicesYamlPath = join(cwd, SERVICES_YAML_NAME);
await Deno.writeTextFile(servicesYamlPath, servicesYamlText);

const derivedCaddyfile = [...srvRecords.values()].map((
  { domains, port },
) =>
  `\
${domains.join(", ")} {
  reverse_proxy localhost:${port}
}
`
).join("\n");

const derivedCaddyfilePath = join(cwd, DERIVED_CADDY_NAME);
await Deno.writeTextFile(derivedCaddyfilePath, derivedCaddyfile);
