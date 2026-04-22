import { spawn } from "node:child_process";

function parseArgs(argv) {
  const [testFile, ...rest] = argv;

  if (!testFile) {
    throw new Error("Usage: node scripts/run-node-test.mjs <test-file> [--reporter=<name>]");
  }

  let reporter = "spec";

  for (const arg of rest) {
    if (arg.startsWith("--reporter=")) {
      reporter = arg.slice("--reporter=".length);
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return { reporter, testFile };
}

function main() {
  const { reporter, testFile } = parseArgs(process.argv.slice(2));
  const child = spawn(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--test",
      "--experimental-strip-types",
      `--test-reporter=${reporter}`,
      testFile,
    ],
    {
      stdio: "inherit",
    }
  );

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  child.on("close", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
