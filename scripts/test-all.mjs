import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const TEST_SCRIPTS = [
  "test:scheduling",
  "test:scheduling-draft",
  "test:availability-time",
];

const SYMBOLS = {
  pass: "✓",
  fail: "✗",
  info: "•",
};

const SECTION_WIDTH = 78;
const SCRIPT_NAME_WIDTH = 24;
const COUNT_WIDTH = 5;

function parseArgs(argv) {
  const options = {
    summaryOnly: false,
  };

  for (const arg of argv) {
    if (arg === "--summary-only" || arg === "--compact") {
      options.summaryOnly = true;
      continue;
    }

    if (arg === "--help") {
      console.log("Usage: node scripts/test-all.mjs [--summary-only|--compact]");
      console.log("");
      console.log("Options:");
      console.log("  --summary-only, --compact   Print only the consolidated suite summary.");
      process.exit(0);
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return options;
}

function line(char = "─", width = SECTION_WIDTH) {
  return char.repeat(width);
}

function padRight(value, width) {
  return String(value).padEnd(width, " ");
}

function padLeft(value, width) {
  return String(value).padStart(width, " ");
}

function fitText(value, width) {
  const text = String(value);
  if (text.length <= width) {
    return padRight(text, width);
  }

  return `${text.slice(0, Math.max(0, width - 3))}...`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    return "n/a";
  }

  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }

  return `${(ms / 1000).toFixed(ms >= 10_000 ? 1 : 2)} s`;
}

function formatTestDuration(ms) {
  if (!Number.isFinite(ms)) {
    return "n/a";
  }

  if (ms < 10) {
    return `${ms.toFixed(2)} ms`;
  }

  if (ms < 1000) {
    return `${ms.toFixed(1)} ms`;
  }

  return formatDuration(ms);
}

function parseTapScalar(value) {
  if (value === undefined || value === "") {
    return "";
  }

  if (value === "null") {
    return null;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
}

function parseTapOutput(output) {
  const parsed = {
    tests: [],
    totals: {
      tests: 0,
      pass: 0,
      fail: 0,
      skipped: 0,
      todo: 0,
      cancelled: 0,
      durationMs: 0,
    },
    notes: [],
  };

  let currentTest = null;
  let inDiagnostics = false;
  let multilineKey = null;

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (!inDiagnostics) {
      const testMatch = line.match(/^(ok|not ok)\s+\d+\s+-\s+(.*?)(?:\s+#\s+(SKIP|TODO)\b.*)?$/);
      if (testMatch) {
        const [, statusWord, name, directive] = testMatch;
        const directiveStatus = directive?.toLowerCase();
        const status =
          directiveStatus === "skip"
            ? "skipped"
            : directiveStatus === "todo"
              ? "todo"
              : statusWord === "ok"
                ? "pass"
                : "fail";

        currentTest = {
          name,
          status,
          durationMs: null,
          diagnostics: {},
        };

        parsed.tests.push(currentTest);
        continue;
      }

      if (line === "  ---") {
        inDiagnostics = true;
        multilineKey = null;
        continue;
      }

      const summaryMatch = line.match(/^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) (.+)$/);
      if (summaryMatch) {
        const [, key, value] = summaryMatch;
        if (key === "duration_ms") {
          parsed.totals.durationMs = Number(value);
        } else if (key === "suites") {
          // Ignore suite counts in the report-facing output.
        } else {
          parsed.totals[key] = Number(value);
        }
        continue;
      }

      if (!line || line === "TAP version 13" || /^# Subtest: /.test(line) || /^\d+\.\.\d+$/.test(line)) {
        continue;
      }

      parsed.notes.push(line);
      continue;
    }

    if (line === "  ...") {
      inDiagnostics = false;
      multilineKey = null;
      continue;
    }

    const keyMatch = line.match(/^  ([A-Za-z_][A-Za-z0-9_]*):(?: (.*))?$/);
    if (keyMatch) {
      const [, key, rawValue = ""] = keyMatch;
      multilineKey = null;

      if (rawValue === "|-" || rawValue === "|") {
        currentTest.diagnostics[key] = "";
        multilineKey = key;
      } else {
        currentTest.diagnostics[key] = parseTapScalar(rawValue);
      }
      continue;
    }

    if (multilineKey && line.startsWith("    ")) {
      const existing = currentTest.diagnostics[multilineKey];
      currentTest.diagnostics[multilineKey] = existing
        ? `${existing}\n${line.slice(4)}`
        : line.slice(4);
      continue;
    }
  }

  for (const test of parsed.tests) {
    if (typeof test.diagnostics.duration_ms === "number") {
      test.durationMs = test.diagnostics.duration_ms;
    }
  }

  if (!parsed.totals.tests) {
    parsed.totals.tests = parsed.tests.length;
  }

  if (!parsed.totals.pass) {
    parsed.totals.pass = parsed.tests.filter((test) => test.status === "pass").length;
  }

  if (!parsed.totals.fail) {
    parsed.totals.fail = parsed.tests.filter((test) => test.status === "fail").length;
  }

  if (!parsed.totals.skipped) {
    parsed.totals.skipped = parsed.tests.filter((test) => test.status === "skipped").length;
  }

  if (!parsed.totals.todo) {
    parsed.totals.todo = parsed.tests.filter((test) => test.status === "todo").length;
  }

  return parsed;
}

function normaliseErrorLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => !line.startsWith("npm error"))
    .map((line) => line.replace(/^# /, ""));
}

function printHeader(options) {
  console.log(line("═"));
  console.log("StageSuite Test Runner");
  console.log(line("═"));
  console.log(`${SYMBOLS.info} Running ${TEST_SCRIPTS.length} underlying test suite(s) sequentially`);

  if (options.summaryOnly) {
    console.log(`${SYMBOLS.info} Summary-only mode enabled`);
  }

  console.log("");
}

function printSectionHeader(scriptName) {
  console.log(`┌${line("─", SECTION_WIDTH - 2)}┐`);
  console.log(`│ ${padRight(scriptName, SECTION_WIDTH - 4)} │`);
  console.log(`└${line("─", SECTION_WIDTH - 2)}┘`);
}

function printTestLines(parsed) {
  for (const test of parsed.tests) {
    const symbol =
      test.status === "pass" ? SYMBOLS.pass : test.status === "fail" ? SYMBOLS.fail : SYMBOLS.info;
    const statusLabel =
      test.status === "pass"
        ? "PASS"
        : test.status === "skipped"
          ? "SKIP"
          : test.status === "todo"
            ? "TODO"
            : "FAIL";

    console.log(
      `${symbol} ${fitText(test.name, 58)} ${padLeft(statusLabel, 4)}  ${padLeft(
        formatTestDuration(test.durationMs),
        9
      )}`
    );

    if (test.status !== "fail") {
      continue;
    }

    const detailLines = [];
    if (typeof test.diagnostics.error === "string" && test.diagnostics.error.trim()) {
      detailLines.push(...normaliseErrorLines(test.diagnostics.error));
    }
    if (typeof test.diagnostics.stack === "string" && test.diagnostics.stack.trim()) {
      detailLines.push(...normaliseErrorLines(test.diagnostics.stack).slice(0, 4));
    }

    for (const detail of detailLines.slice(0, 6)) {
      console.log(`  ${detail}`);
    }
  }
}

function printScriptSummary(result) {
  const { script, durationMs, parsed } = result;
  const summarySymbol = parsed.totals.fail > 0 || result.exitCode !== 0 ? SYMBOLS.fail : SYMBOLS.pass;

  console.log(line("─"));
  console.log(
    `${summarySymbol} ${script}  ${parsed.totals.tests} tests (${parsed.totals.pass} passed, ${parsed.totals.fail} failed)  ${formatDuration(
      durationMs
    )}`
  );

  if (parsed.totals.skipped > 0) {
    console.log(`${SYMBOLS.info} Skipped: ${parsed.totals.skipped}`);
  }

  if (parsed.totals.todo > 0) {
    console.log(`${SYMBOLS.info} Todo: ${parsed.totals.todo}`);
  }

  if (parsed.notes.length > 0) {
    console.log(`${SYMBOLS.info} Additional output:`);
    for (const note of parsed.notes.slice(0, 8)) {
      console.log(`  ${note}`);
    }
  }

  if (parsed.tests.length === 0 && result.outputLines.length > 0) {
    console.log(`${SYMBOLS.info} Raw output:`);
    for (const lineText of result.outputLines.slice(0, 12)) {
      console.log(`  ${lineText}`);
    }
  }

  console.log("");
}

function runScript(scriptName) {
  return new Promise((resolve) => {
    const start = performance.now();
    const child = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "--silent", scriptName, "--", "--reporter=tap"],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      const durationMs = performance.now() - start;
      resolve({
        script: scriptName,
        durationMs,
        exitCode: 1,
        parsed: parseTapOutput(""),
        outputLines: normaliseErrorLines(String(error)),
      });
    });

    child.on("close", (code) => {
      const durationMs = performance.now() - start;
      const parsed = parseTapOutput(stdout);
      const outputLines = normaliseErrorLines(`${stdout}\n${stderr}`);

      if (code !== 0 && parsed.totals.fail === 0 && parsed.totals.tests === 0) {
        parsed.totals.fail = 1;
      }

      resolve({
        script: scriptName,
        durationMs,
        exitCode: code ?? 1,
        parsed,
        outputLines,
      });
    });
  });
}

function buildOverallTotals(results) {
  return results.reduce(
    (totals, result) => {
      totals.tests += result.parsed.totals.tests;
      totals.pass += result.parsed.totals.pass;
      totals.fail += result.parsed.totals.fail;
      totals.skipped += result.parsed.totals.skipped;
      totals.todo += result.parsed.totals.todo;
      return totals;
    },
    { tests: 0, pass: 0, fail: 0, skipped: 0, todo: 0 }
  );
}

function buildFailureHighlights(results) {
  const highlights = [];

  for (const result of results) {
    for (const test of result.parsed.tests) {
      if (test.status !== "fail") {
        continue;
      }

      highlights.push({
        script: result.script,
        name: test.name,
      });
    }

    if (result.exitCode !== 0 && result.parsed.tests.length === 0) {
      highlights.push({
        script: result.script,
        name: "Suite failed before reporting individual test results",
      });
    }
  }

  return highlights;
}

function printFinalSummary(results, totalDurationMs, options) {
  const totals = buildOverallTotals(results);
  const failureHighlights = buildFailureHighlights(results);

  console.log(line("═"));
  console.log(options.summaryOnly ? "Compact Summary" : "Final Summary");
  console.log(line("═"));

  for (const result of results) {
    const statusSymbol = result.parsed.totals.fail > 0 || result.exitCode !== 0 ? SYMBOLS.fail : SYMBOLS.pass;
    console.log(
      `${statusSymbol} ${padRight(result.script, SCRIPT_NAME_WIDTH)} ${padLeft(
        result.parsed.totals.tests,
        COUNT_WIDTH
      )} tests  ${padLeft(result.parsed.totals.pass, COUNT_WIDTH)} passed  ${padLeft(
        result.parsed.totals.fail,
        COUNT_WIDTH
      )} failed  ${padLeft(formatDuration(result.durationMs), 8)}`
    );
  }

  console.log(line("─"));
  console.log(`Total tests:   ${totals.tests}`);
  console.log(`Passed:        ${totals.pass}`);
  console.log(`Failed:        ${totals.fail}`);

  if (totals.skipped > 0) {
    console.log(`Skipped:       ${totals.skipped}`);
  }

  if (totals.todo > 0) {
    console.log(`Todo:          ${totals.todo}`);
  }

  console.log(`Total runtime: ${formatDuration(totalDurationMs)}`);

  if (failureHighlights.length > 0) {
    console.log(line("─"));
    console.log("Failed tests:");
    for (const failure of failureHighlights) {
      console.log(`${SYMBOLS.fail} ${failure.script} :: ${failure.name}`);
    }
  }

  console.log(line("═"));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const overallStart = performance.now();
  const results = [];

  printHeader(options);

  for (const script of TEST_SCRIPTS) {
    if (!options.summaryOnly) {
      printSectionHeader(script);
    }

    const result = await runScript(script);

    if (!options.summaryOnly) {
      printTestLines(result.parsed);
      printScriptSummary(result);
    }

    results.push(result);
  }

  const totalDurationMs = performance.now() - overallStart;
  printFinalSummary(results, totalDurationMs, options);

  process.exit(results.some((result) => result.exitCode !== 0 || result.parsed.totals.fail > 0) ? 1 : 0);
}

main().catch((error) => {
  console.error(line("═"));
  console.error("StageSuite Test Runner");
  console.error(line("═"));
  console.error("Unexpected error while running aggregated tests.");
  console.error(error);
  process.exit(1);
});
