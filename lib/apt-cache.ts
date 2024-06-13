import { assert } from "jsr:@std/assert";
import $ from "jsr:@david/dax";
type n = number;
type s = string;
type PkgVersion = `${n}:${n}.${n}.${n}-${n}${s}${n}.${n}+${s}`;
export class Policy {
  _raw = "";
  installed: PkgVersion | "" = "";
  candidate: PkgVersion | "" = "";
  currentOrigins: {
    origin: string;
    label?: string;
    arch?: string;
  }[] = [];
  versionRecords: {
    id: PkgVersion;
    resolvedPriority: number;
    sources: {
      priority: number;
      origin: string;
      label?: string;
      arch?: string;
    }[];
  }[] = [];
  constructor(private packageName: string, raw: string) {
    const [pkg, installed, candidate, versionTableHead, ...versionTable] = raw
      .split("\n");
    const _pkg = pkg.slice(0, -1);
    assert(
      _pkg === this.packageName,
      `Expected package policy name to be ${this.packageName}, got ${_pkg}`,
    );
    assert(
      installed.startsWith("  Installed: "),
      `Expected policy installed line to start with '  Installed: ', got ${installed}`,
    );
    assert(
      candidate.startsWith("  Candidate: "),
      `Expected policy candidate line to start with '  Candidate: ', got ${candidate}`,
    );
    assert(
      versionTableHead === "  Version table:",
      `Expected policy version table head to be '  Version table:', got ${versionTableHead}`,
    );
    this.installed = installed.replace("  Installed: ", "")
      .trim() as PkgVersion;
    this.candidate = candidate.replace("  Candidate: ", "")
      .trim() as PkgVersion;
    for (const line of versionTable) {
      const header = line.slice(5);
      if (!header.startsWith("   ")) {
        const [id, priority] = header.split(" ");
        this.versionRecords.push({
          id: id as PkgVersion,
          resolvedPriority: parseInt(priority),
          sources: [],
        });
      } else {
        const recordStr = header.slice(3);
        const [priority, origin, ...optional] = recordStr.split(" ");
        const lastOptional = optional.pop();
        assert(
          lastOptional === "Packages" || lastOptional === undefined,
          `Expected last optional field to be 'Packages' or undefined, got ${lastOptional}`,
        );
        const arch = optional.pop();
        const label = optional.pop();
        this.versionRecords[this.versionRecords.length - 1].sources.push({
          priority: parseInt(priority),
          origin,
          label,
          arch,
        });
      }
    }
    const resolvedVersion = this.versionRecords.find((record) =>
      record.id === this.installed
    );
    if (!resolvedVersion) {
      return;
    }
    const resolvedSources = resolvedVersion.sources;
    this.currentOrigins = (resolvedSources ?? []).filter((source) =>
      source.priority === resolvedVersion.resolvedPriority
    ).map((source) => ({
      origin: source.origin,
      label: source.label,
      arch: source.arch,
    }));
  }
  static async fromCLI(packageName: string) {
    const raw = await $`apt-cache policy ${packageName}`.text();
    return new Policy(packageName, raw);
  }
}
