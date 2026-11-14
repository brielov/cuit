import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Runs the publish step of the CI workflow the way GitHub Actions would, with a fake
 * `npm` on PATH, so a change to the command or to the shell it runs under is tested.
 */

type Step = { name?: string; run?: string; shell?: string };
type Job = { steps: Step[]; defaults?: { run?: { shell?: string } } };
type Workflow = { jobs: Record<string, Job>; defaults?: { run?: { shell?: string } } };

const workflow = Bun.YAML.parse(
  await Bun.file(join(import.meta.dir, "../.github/workflows/ci.yml")).text(),
) as Workflow;

const publishJob = workflow.jobs.publish!;
const publishStep = publishJob.steps.find((s) => s.name === "Publish to npm")!;

/** The command line GitHub Actions uses for a `run` step on Linux. */
function shellFor(step: Step, job: Job): string[] {
  const shell = step.shell ?? job.defaults?.run?.shell ?? workflow.defaults?.run?.shell;
  if (shell === undefined) return ["bash", "-e"];
  if (shell === "bash") return ["bash", "--noprofile", "--norc", "-eo", "pipefail"];
  if (shell === "sh") return ["sh", "-e"];
  throw new Error(`unhandled shell: ${shell}`);
}

function runPublish(npmOutput: string, npmExit: number): number {
  const dir = mkdtempSync(join(tmpdir(), "cuit-publish-"));
  const npm = join(dir, "npm");
  writeFileSync(npm, `#!/bin/sh\necho ${JSON.stringify(npmOutput)} >&2\nexit ${npmExit}\n`);
  chmodSync(npm, 0o755);
  const script = join(dir, "step.sh");
  writeFileSync(script, publishStep.run!);
  const proc = Bun.spawnSync([...shellFor(publishStep, publishJob), script], {
    cwd: dir,
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    stdout: "ignore",
    stderr: "ignore",
  });
  return proc.exitCode;
}

describe("CI publish step", () => {
  test("succeeds when npm publish succeeds", () => {
    expect(runPublish("+ cuit@9.9.9", 0)).toBe(0);
  });

  test("fails when npm publish fails", () => {
    expect(runPublish("npm error code E404\nnpm error 404 Not Found - PUT", 1)).not.toBe(0);
    expect(runPublish("npm error code ENEEDAUTH", 1)).not.toBe(0);
  });

  test("skips when the version is already published", () => {
    const conflict =
      "npm error code E403\nnpm error 403 You cannot publish over the previously published versions: 2.0.0.";
    expect(runPublish(conflict, 1)).toBe(0);
  });
});
