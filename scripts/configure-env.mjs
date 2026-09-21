/* global process, console */
import { spawnSync } from "node:child_process";
import { loadEnvFile } from "node:process";
loadEnvFile(".env.local");
const cli = process.argv[2];
if (!cli) throw new Error("Vercel CLI entry path is required");
for (const name of ["TYPESAFE_API_KEY", "JEV_ACCESS_CODE"]) {
  if (!process.env[name]) throw new Error(`${name} is missing`);
  for (const target of ["production"]) {
    const r = spawnSync(
      process.execPath,
      [cli, "env", "add", name, target, "--sensitive", "--yes", "--force"],
      { input: process.env[name], encoding: "utf8", windowsHide: true },
    );
    if (r.status !== 0) {
      let error = r.stderr;
      for (const secret of [
        process.env.TYPESAFE_API_KEY,
        process.env.JEV_ACCESS_CODE,
      ])
        error = error.split(secret).join("[REDACTED]");
      throw new Error(`${name} / ${target}: ${error}`);
    }
    console.log(`${name} / ${target}: configured (value hidden)`);
  }
}
