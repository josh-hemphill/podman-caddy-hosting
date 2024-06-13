#!/usr/bin/env -S deno run --allow-all
import { exists } from "jsr:@std/fs/exists";
import * as color from "jsr:@std/fmt/colors";
import * as log from "jsr:@std/log";
import { join } from "jsr:@std/path@1.0.0-rc.1/join";
const denoPath = Deno.args[0];
if (!denoPath) {
  log.error(
    "Please provide the path to the deno binary (so we can infer the installation paths)",
  );
  Deno.exit(1);
}
const pathSeg = denoPath.split("/").reverse();
const [_deno, binDir, denoDir, ...rest] = pathSeg;
const root = rest.reverse().join("/");

const checkIrregular = (dir: [string, string], expected: [string, string]) =>
  dir[0] !== expected[0]
    ? log.warn(
      `Expected ${dir[1]} directory to be ${expected[1]}, got ${
        dir[0]
      }, please check your installation`,
    )
    : null;

checkIrregular([binDir, "Deno bin"], ["bin", "bin"]);
checkIrregular([denoDir, "DENO_INSTALL"], [".deno", ".deno"]);
checkIrregular([root, "Deno root"], [
  Deno.env.get("HOME") ?? "",
  "your home directory",
]);

const servicesDir = join(Deno.cwd(), "services");
const checkEnvsByTemplate = [Deno.cwd()];
for (const dir of Deno.readDirSync(servicesDir)) {
  if (dir.isDirectory) {
    const envTemplatePath = join(servicesDir, dir.name, ".env.template");
    const yamlPath = join(servicesDir, dir.name, "template.kube.yaml");
    if (await exists(envTemplatePath) && await exists(yamlPath)) {
      console.log(`Found service: ${dir.name}`);
      checkEnvsByTemplate.push(join(servicesDir, dir.name));
    }
  }
}
for (const envDir of checkEnvsByTemplate) {
  const envPath = join(envDir, ".env");
  const envTemplatePath = join(envDir, ".env.template");
  if (!await exists(envPath)) {
    log.info(
      `No .env file found for ${envDir}, creating one based on the template...`,
    );
    const envTemplate = await Deno.readTextFile(envTemplatePath);
    await Deno.writeTextFile(envPath, envTemplate);
    log.warn(
      `Please fill in the necessary environment variables in ${envPath}`,
    );
  }
}

const rcEditMin = `export DENO_INSTALL="${[root, denoDir].join("/")}"
export PATH="$DENO_INSTALL/${binDir}:$PATH"`;
const rcEdit = `
# deno
${rcEditMin}
# deno end
`;

const home = Deno.env.get("HOME") ?? root;
const rcPath = [
  `${home}/.bashrc`,
  `${home}/.bash_profile`,
  `${home}/.zshrc`,
  `${home}/.profile`,
].find((path) => exists(path));

if (!rcPath) {
  log.error("Could not find a suitable rc file to write to");
  Deno.exit(1);
}

const original = await Deno.readTextFile(rcPath);

if (original.includes(rcEdit)) {
  log.info(
    `It seems that ${rcPath} already has the necessary setup; exiting...`,
  );
  Deno.exit(0);
}

console.log(`Env setup text:
${color.dim(rcEditMin)}`);

const proceed = confirm(`Do you want to write this to ${rcPath}?`);
if (!proceed) {
  console.log("Exiting...");
  Deno.exit(0);
}
await Deno.writeTextFile(rcPath, rcEdit, { append: true });
log.info(`Successfully wrote to ${rcPath}`);
const command = color.bold(`source ${rcPath}`);
log.info(`Please run \`${command}\` to apply the changes`);
