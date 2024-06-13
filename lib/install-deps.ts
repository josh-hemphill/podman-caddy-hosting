#!/usr/bin/env -S deno run --allow-all
import * as color from "jsr:@std/fmt/colors";
import * as log from "jsr:@std/log";
import $ from "jsr:@david/dax";
import { Policy } from "./apt-cache.ts";
import { AlternativeQuery } from "./bin-alternatives.ts";
import { join } from "jsr:@std/path@^0.221.0/join";
import { ensureDir } from "jsr:@std/fs@0.221.0/ensure-dir";

const downloadDir = ".bin";
ensureDir(downloadDir);
const testedPlatforms: [string, string][] = [
  ["Ubuntu", "22.04"],
];

log.info("Checking OS version");
const [osId, osRelease] = await $`lsb_release -irs`.lines();
const isSupported = testedPlatforms.some(([tOsId, tOsRelease]) => {
  return tOsId === osId && tOsRelease === osRelease;
});
if (!isSupported) {
  console.log(
    color.yellow(
      `This script has only been tested on the following platforms: ${
        testedPlatforms.map((v) => v.join("-")).join(", ")
      }`,
    ),
  );
  log.warn("The OS version is not officially supported");
  if (!(await $.confirm("Do you want to continue anyway?"))) {
    log.error("Exiting");
    Deno.exit(1);
  }
}

log.info("Installing required software");

// Download and install the latest version Caddy with the plugins we need
{
  log.info("Checking for installed caddy binaries");
  const { installed, currentOrigins } = await Policy.fromCLI("caddy");
  const alternatives = await AlternativeQuery.fromQuery("caddy");

  log.info("If Caddy systemd service running, stop to prevent conflicts");
  const isRunning = await $`sudo systemctl is-active caddy`.text();
  if (isRunning === "active") await $`sudo systemctl stop caddy`;

  log.info("Installing Caddy");
  const requestUrl = (() => {
    const x = new URL("https://caddyserver.com/api/download");
    x.searchParams.append("os", "linux");
    x.searchParams.append("arch", "amd64");
    x.searchParams.append("p", "github.com/caddy-dns/cloudflare");
    return x.href;
  })();
  const downloadPath = join(downloadDir, "caddy");
  const caddyBinExists = $.path(downloadPath).isFileSync();
  let download = true;
  if (caddyBinExists) {
    log.info(`Caddy binary already exists at ${downloadPath}`);
    if (!(await $.confirm("Do you want to re-download it?"))) {
      log.info("Skipping download");
      download = false;
    }
  }
  if (download) {
    log.info(`Downloading Caddy from ${requestUrl} \nto ${downloadPath}`);
    await $.request(requestUrl)
      .showProgress()
      .pipeToPath(downloadPath);
  }

  if (!installed) {
    log.info(
      "Caddy is not installed via apt, installing it now to obtain support files",
    );
    const baseSrc = "https://dl.cloudsmith.io/public/caddy/stable";
    if (
      currentOrigins.length === 0 ||
      !currentOrigins.some((o) => o.origin.startsWith(baseSrc))
    ) {
      await $`sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl`;
      await $`curl -1sLf '${baseSrc}/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg`;
      await $`curl -1sLf '${baseSrc}/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list`;
    }
    await $`sudo apt-get update`;
    await $`sudo apt-get install caddy`;
  }
  log.info(
    "Diverting where apt-installed version of Caddy lives to /usr/bin/caddy.default",
  );
  await $`sudo dpkg-divert --divert /usr/bin/caddy.default --rename /usr/bin/caddy`;
  log.info("Moving downloaded Caddy to /usr/bin/caddy.custom");
  await $`sudo cp -u --no-preserve=ownership ${downloadPath} /usr/bin/caddy.custom`;
  await $`sudo chmod +x /usr/bin/caddy.custom`;

  log.info(
    "Registering the caddy executables as update-alternatives to support switching between them",
  );
  [
    { path: "/usr/bin/caddy.custom", priority: 50 },
    { path: "/usr/bin/caddy.default", priority: 10 },
  ].forEach(async ({ path, priority }) => {
    if (
      !alternatives.alternatives.some((a) =>
        a.path === path && a.priority === priority
      )
    ) {
      log.info(`Registering ${path} with priority ${priority}`);
      await $`sudo update-alternatives --install /usr/bin/caddy caddy ${path} ${priority}`;
    }
  });

  log.info("Restarting Caddy systemd service to pick up the changes");
  await $`sudo systemctl restart caddy`;
}

// Install the latest version of Podman with successful builds for this OS
{
  const sources_url =
    `https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/unstable/xUbuntu_${osRelease}`;

  log.info("Checking for installed podman binaries");
  const { installed, currentOrigins } = await Policy.fromCLI("podman");
  let download = true;
  if (
    installed && currentOrigins.some((o) => o.origin.startsWith(sources_url))
  ) {
    log.info("Podman is already installed from the kubic repository");
    if (!(await $.confirm("Do you want to re-install it?"))) {
      log.info("Skipping install");
      download = false;
    }
  }
  if (download) {
    log.info("Installing Podman");
    log.info("Adding Podman repository");
    await $`echo "deb ${sources_url}/ /" | sudo tee /etc/apt/sources.list.d/devel:kubic:libcontainers:unstable.list`;
    await $`curl -fsSL ${sources_url}/Release.key | sudo gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/devel_kubic_libcontainers_unstable.gpg > /dev/null`;
    log.info("Updating package list");
    await $`sudo apt update`;
    log.info("Installing Podman from the kubic repository");
    await $`sudo apt install podman`;
  }
}
