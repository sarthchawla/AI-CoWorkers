import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, "docs", "demo-recordings");
const videoName = "scrum-master-manager-glimpse";
const recordingDir = path.join(outputDir, ".recording-tmp");
const appUrl = process.env.DEMO_APP_URL ?? "http://127.0.0.1:5174/";
const playwrightEntry =
  process.env.PLAYWRIGHT_ENTRY ?? "/tmp/ai-coworkers-recording-runtime/node_modules/playwright/index.mjs";

const captions = {
  objective:
    "Objective: a quick glimpse of an AI Scrum Master coworker that turns manual Excel, Jira reporting, and leave coordination into a guided editable workflow.",
  home:
    "Start from the sprint plan list. Plans are persisted so an SM can resume mid-planning or review past sprint decisions.",
  setup:
    "Step 1 captures configurable team context: Jira project, board, manual leave channel, and sprint naming pattern.",
  clone:
    "Clone the previous sprint context instead of copying a spreadsheet tab. The workflow stays editable at every step.",
  calendar:
    "Calendar context is carried forward: sprint dates, holidays, working days, and team size remain adjustable.",
  slack:
    "Leave collection stays manual for now. The app drafts the message but does not send to Slack or read a thread.",
  slackResult:
    "The Scrum Master updates leave confirmations manually, and every teammate row remains editable before capacity is finalized.",
  save:
    "Save creates an audit point before connector reads. Only read-only Jira reporting runs against a clean saved session.",
  jiraClose:
    "Jira write operations are intentionally manual for now. The app gives the sprint link and waits for the SM to close it.",
  jiraRead:
    "After closure, the app reads Jira reporting and updates the past sprint net velocity/dev rows in one place.",
  decision:
    "The decision step keeps net velocity/dev as the primary metric and allows a per-developer override with rationale.",
  finalize:
    "Finalize and save the plan. The sprint list becomes the home base for continuing or reviewing planning sessions.",
  future:
    "Future plans: real read-only Jira adapters, AI summaries for messy leave context, spillover/risk reasoning, and sprint goal tracking."
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function fetchOk(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function updateCaption(page, text) {
  await page.evaluate((nextText) => {
    document.querySelector("[data-demo-caption]").textContent = nextText;
  }, text);
}

async function pause(page, text, ms = 2800) {
  await updateCaption(page, text);
  await wait(ms);
}

async function clickFrameText(frame, text) {
  const locator = frame.getByText(text, { exact: true });
  await locator.waitFor({ state: "visible", timeout: 10000 });
  await locator.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  await locator.click();
}

async function clickFrameButton(frame, name) {
  const locator = frame.getByRole("button", { name, exact: true });
  await locator.waitFor({ state: "visible", timeout: 10000 });
  await locator.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  await locator.click();
}

async function fillFrameLabel(frame, label, value) {
  const locator = frame.getByLabel(label, { exact: true });
  await locator.waitFor({ state: "visible", timeout: 10000 });
  await locator.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  await locator.fill(value);
}

async function frameHasText(frame, text) {
  return frame.getByText(text, { exact: false }).count().then((count) => count > 0);
}

async function main() {
  if (!(await fetchOk(new URL("/api/health", appUrl).toString()))) {
    throw new Error(`App/API is not reachable through ${appUrl}. Start the dev server before recording.`);
  }

  const { chromium } = await import(pathToFileURL(playwrightEntry).href);

  await mkdir(outputDir, { recursive: true });
  await rm(recordingDir, { recursive: true, force: true });
  await mkdir(recordingDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1180 },
    recordVideo: {
      dir: recordingDir,
      size: { width: 1440, height: 1180 }
    }
  });
  const page = await context.newPage();

  await page.setContent(
    `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          html, body { margin: 0; width: 1440px; height: 1180px; background: #f5f7fb; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; overflow: hidden; }
          .caption {
            height: 190px;
            padding: 34px 54px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #101828;
            color: #f8fafc;
            border-bottom: 1px solid #d0d5dd;
          }
          .caption-text {
            max-width: 1180px;
            font-size: 34px;
            line-height: 1.25;
            font-weight: 760;
            letter-spacing: 0;
            text-align: center;
          }
          .demo-frame {
            width: 1440px;
            height: 990px;
            border: 0;
            display: block;
            background: white;
          }
        </style>
      </head>
      <body>
        <section class="caption"><div class="caption-text" data-demo-caption>${captions.objective}</div></section>
        <iframe class="demo-frame" src="${appUrl}" title="AI CoWorkers demo"></iframe>
      </body>
    </html>`
  );

  const frameElement = page.frameLocator("iframe.demo-frame");
  await frameElement.getByText("Sprint plans", { exact: true }).waitFor({ state: "visible", timeout: 20000 });
  const frame = page.frames().find((candidate) => candidate.url().startsWith(appUrl));

  if (!frame) {
    throw new Error("Could not find app frame for recording.");
  }

  await pause(page, captions.objective, 4200);
  await pause(page, captions.home, 3600);

  await clickFrameButton(frame, "New sprint plan");
  await pause(page, captions.setup, 3400);

  await clickFrameButton(frame, "Clone sprint");
  await pause(page, captions.clone, 3000);

  await clickFrameButton(frame, "Confirm calendar");
  await pause(page, captions.calendar, 3000);

  await fillFrameLabel(
    frame,
    "Manual leave request draft",
    "Hi team, please confirm leave updates for Q2S6 and Q2S7. Reply with previous and upcoming leave days."
  );
  await pause(page, captions.slack, 3600);

  await clickFrameButton(frame, "Confirm leave rows");
  await frame.getByText("Manual Jira action", { exact: false }).waitFor({ state: "visible", timeout: 10000 });
  await pause(page, captions.slackResult, 3600);

  await clickFrameButton(frame, "Save");
  await frame.getByText("Sprint planning session saved", { exact: false }).waitFor({ state: "visible", timeout: 10000 });
  await pause(page, captions.save, 3000);

  await clickFrameButton(frame, "I closed it in Jira");
  await pause(page, captions.jiraClose, 3600);

  await clickFrameButton(frame, "Pull Jira velocity history");
  await frame.getByText("Jira closed sprint net velocity/dev updated", { exact: false }).waitFor({
    state: "visible",
    timeout: 10000
  });
  await pause(page, captions.jiraRead, 3600);

  await fillFrameLabel(frame, "Avg net velocity per developer override", "18.4");
  await fillFrameLabel(frame, "Override reason", "Team confidence is higher because low-risk spillover is already groomed.");
  await pause(page, captions.decision, 4200);

  await clickFrameButton(frame, "Finalize net velocity/dev");
  await frame.getByText("Planning status", { exact: true }).waitFor({ state: "visible", timeout: 10000 });
  await pause(page, captions.finalize, 3000);

  if (await frameHasText(frame, "Planning status")) {
    await clickFrameButton(frame, "Save final plan");
    await frame.getByText("Sprint planning session saved", { exact: false }).waitFor({
      state: "visible",
      timeout: 10000
    });
  }

  await clickFrameButton(frame, "Sprint list");
  await frame.getByText("Sprint plans", { exact: true }).waitFor({ state: "visible", timeout: 10000 });
  await pause(page, captions.future, 5600);

  await page.screenshot({ path: path.join(outputDir, `${videoName}-preview.png`), fullPage: false });
  await context.close();
  await browser.close();

  const files = await readdir(recordingDir);
  const webm = files.find((file) => file.endsWith(".webm"));

  if (!webm) {
    throw new Error("Playwright did not produce a WebM recording.");
  }

  const webmPath = path.join(outputDir, `${videoName}.webm`);
  const mp4Path = path.join(outputDir, `${videoName}.mp4`);
  await rm(webmPath, { force: true });
  await rm(mp4Path, { force: true });
  await run("mv", [path.join(recordingDir, webm), webmPath]);
  await run("/opt/homebrew/bin/ffmpeg", [
    "-y",
    "-i",
    webmPath,
    "-vf",
    "pad=ceil(iw/2)*2:ceil(ih/2)*2",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    mp4Path
  ]);

  await writeFile(
    path.join(outputDir, `${videoName}-talk-track.md`),
    `# AI Scrum Master Manager Demo Talk Track

## Objective

Show a concise glimpse of the AI Scrum Master coworker: a guided sprint planning workflow that replaces spreadsheet copying and coordinates editable Jira reporting and manual leave planning steps.

## Demo Flow

1. Start from the sprint plan list where plans can be resumed or reviewed.
2. Start a new sprint plan with configurable team, Jira, manual leave channel, and sprint naming settings.
3. Clone previous sprint context and carry calendar details forward.
4. Edit the manual leave request draft for the configured channel.
5. Confirm manually updated leave rows without running any Slack connector.
6. Save an audit point before connector reads.
7. Keep Jira writes manual: the SM closes the sprint in Jira from the provided link.
8. Pull read-only Jira reporting for completed net velocity/dev.
9. Override net velocity/dev per developer with a clear rationale.
10. Save the plan and return to the sprint list.

## Future Plans

- Replace mock Jira reporting with a live read-only Jira adapter.
- Use AI to summarize messy leave context and unresolved replies.
- Add spillover and sprint-risk reasoning.
- Recommend sprint goals and track milestone health through the sprint.
`,
    "utf8"
  );

  console.log(`Wrote ${mp4Path}`);
  console.log(`Wrote ${webmPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
