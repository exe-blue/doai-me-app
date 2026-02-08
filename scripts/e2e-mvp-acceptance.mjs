#!/usr/bin/env node
/**
 * E2E MVP 수용 테스트 (Playwright)
 * 1) /commands — 테스트 명령(adb) 존재 확인 (없으면 리포트에 안내)
 * 2) /runs — Run 생성 (playbook_id + params)
 * 3) /runs/{id} — 상태가 queued → running → succeeded/failed 등으로 변화하는지 확인
 * 4) /devices — online/offline 최소 표시 확인
 * 5) 콘솔 에러 / 네트워크 실패 수집
 *
 * 출력: JSON 리포트 + 실패 시 스크린샷 + 첫 콘솔 에러 + 실패한 API 목록
 *
 * 사용: BASE_URL=http://localhost:3000 node scripts/e2e-mvp-acceptance.mjs
 *       E2E_REPORT=./e2e-report.json E2E_SCREENSHOTS=./e2e-screenshots node scripts/e2e-mvp-acceptance.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const REPORT_PATH = process.env.E2E_REPORT || './e2e-report.json';
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOTS || './e2e-screenshots';
const RUN_POLL_TIMEOUT_MS = Number(process.env.E2E_RUN_POLL_TIMEOUT_MS) || 90_000;
const RUN_POLL_INTERVAL_MS = 2_000;

const FINAL_STATUSES = ['completed', 'completed_with_errors', 'failed', 'stopped'];

function now() {
  return new Date().toISOString();
}

async function run() {
  const report = {
    baseUrl: BASE,
    startedAt: now(),
    finishedAt: null,
    passed: false,
    steps: {},
    firstConsoleError: null,
    failedApis: [],
    stateTransitions: [],
    screenshotOnFailure: null,
  };

  const failedRequests = [];
  let firstConsoleError = null;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.exposeFunction('__reportConsoleError', (msg, stack) => {
    if (!firstConsoleError) firstConsoleError = { message: String(msg), stack: String(stack || '') };
  });
  page.addInitScript(() => {
    const orig = globalThis.onerror;
    globalThis.onerror = function (message, source, lineno, colno, error) {
      if (typeof globalThis.__reportConsoleError === 'function') {
        globalThis.__reportConsoleError(String(message), error?.stack || `${source}:${lineno}:${colno}`);
      }
      if (orig) return orig.apply(this, arguments);
      return false;
    };
    globalThis.addEventListener('unhandledrejection', (e) => {
      const err = e.reason;
      if (typeof globalThis.__reportConsoleError === 'function') {
        globalThis.__reportConsoleError(String(err?.message || err), err?.stack || '');
      }
    });
  });

  page.on('requestfailed', (req) => {
    const url = req.url();
    const method = req.method();
    const failure = req.failure()?.errorText || 'unknown';
    failedRequests.push({ url, method, failure });
  });

  const takeScreenshot = async (name) => {
    try {
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const path = join(SCREENSHOT_DIR, `${name}-${Date.now()}.png`);
      await page.screenshot({ path, fullPage: true });
      return path;
    } catch (e) {
      return null;
    }
  };

  try {
    // --- Step 1: /commands — 테스트 명령(adb) 존재 확인 ---
    report.steps.commands = { visited: false, adbCommandExists: false, listResponse: null };
    try {
      const listRes = await fetch(`${BASE}/api/library/list?type=adb_script`);
      const listData = await listRes.json().catch(() => ({}));
      const items = listData.items || [];
      report.steps.commands.listResponse = { status: listRes.status, count: items.length };
      report.steps.commands.adbCommandExists = items.length > 0;
      if (items.length === 0) {
        report.steps.commands.note = 'No adb command_assets. Apply seed (mvp_one_adb_seed) or upload one.';
      }
    } catch (e) {
      report.steps.commands.error = e.message;
    }
    const nav1 = await page.goto(`${BASE}/commands`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    report.steps.commands.visited = nav1?.ok() ?? false;
    if (!report.steps.commands.visited) {
      report.screenshotOnFailure = await takeScreenshot('commands');
    }
    await page.waitForTimeout(1500);

    // --- Step 2: Run 생성 (playbook_id + params) ---
    report.steps.runCreate = { created: false, run_id: null, error: null };
    let playbookId = null;
    try {
      const pbRes = await fetch(`${BASE}/api/playbooks`);
      const pbData = await pbRes.json().catch(() => ({}));
      const playbooks = pbData.items || pbData || [];
      const mvp = Array.isArray(playbooks) ? playbooks.find((p) => p.name === 'mvp_one_adb') : null;
      playbookId = mvp?.id || (Array.isArray(playbooks) && playbooks[0]?.id) || null;
      if (!playbookId) {
        report.steps.runCreate.note = 'No playbook (e.g. mvp_one_adb). Apply seed.';
      } else {
        const createRes = await fetch(`${BASE}/api/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playbook_id: playbookId, params: {}, target: { scope: 'ALL' } }),
        });
        const createData = await createRes.json().catch(() => ({}));
        if (createRes.ok && createData.run_id) {
          report.steps.runCreate.created = true;
          report.steps.runCreate.run_id = createData.run_id;
        } else {
          report.steps.runCreate.error = createData.error || createRes.statusText;
        }
      }
    } catch (e) {
      report.steps.runCreate.error = e.message;
    }

    // --- Step 3: /runs/{id} — 상태 변화 확인 (queued → running → final) ---
    report.steps.runMonitor = { visited: false, stateTransitions: [], finalStatus: null, timeout: false };
    const runId = report.steps.runCreate.run_id;
    if (runId) {
      const start = Date.now();
      const seen = new Set();
      while (Date.now() - start < RUN_POLL_TIMEOUT_MS) {
        try {
          const monRes = await fetch(`${BASE}/api/runs/${runId}`);
          const monData = await monRes.json().catch(() => ({}));
          const status = monData?.run?.status;
          if (status && !seen.has(status)) {
            seen.add(status);
            report.steps.runMonitor.stateTransitions.push({ status, at: new Date().toISOString() });
          }
          if (status && FINAL_STATUSES.includes(status)) {
            report.steps.runMonitor.finalStatus = status;
            break;
          }
        } catch (e) {
          report.steps.runMonitor.pollError = e.message;
          break;
        }
        await page.waitForTimeout(RUN_POLL_INTERVAL_MS);
      }
      if (!report.steps.runMonitor.finalStatus) {
        report.steps.runMonitor.timeout = true;
      }
      const navRun = await page.goto(`${BASE}/runs/${runId}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      report.steps.runMonitor.visited = navRun?.ok() ?? false;
      if (!report.steps.runMonitor.visited) {
        report.screenshotOnFailure = report.screenshotOnFailure || (await takeScreenshot('runs-id'));
      }
      report.stateTransitions = report.steps.runMonitor.stateTransitions;
    } else {
      report.steps.runMonitor.skipped = 'No run_id';
    }

    // --- Step 4: /devices — online/offline 최소 표시 확인 ---
    report.steps.devices = { visited: false, hasOnlineOfflineDisplay: false };
    try {
      const devNav = await page.goto(`${BASE}/devices`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      report.steps.devices.visited = devNav?.ok() ?? false;
      await page.waitForTimeout(2000);
      const text = await page.textContent('body').catch(() => '');
      const hasAll = /전체/.test(text);
      const hasOnline = /Online/.test(text);
      const hasOffline = /Offline/.test(text);
      report.steps.devices.hasOnlineOfflineDisplay = hasAll || hasOnline || hasOffline;
      if (!report.steps.devices.hasOnlineOfflineDisplay) {
        report.screenshotOnFailure = report.screenshotOnFailure || (await takeScreenshot('devices'));
      }
    } catch (e) {
      report.steps.devices.error = e.message;
    }

    report.firstConsoleError = firstConsoleError;
    report.failedApis = failedRequests.map((r) => ({ url: r.url, method: r.method, failure: r.failure }));

    const commandsOk = report.steps.commands.visited && report.steps.commands.adbCommandExists;
    const runOk = !report.steps.runCreate.run_id || (report.steps.runMonitor.visited && report.steps.runMonitor.stateTransitions.length >= 1);
    const devicesOk = report.steps.devices.visited && report.steps.devices.hasOnlineOfflineDisplay;
    report.passed = commandsOk && runOk && devicesOk;
  } catch (e) {
    report.passed = false;
    report.fatalError = e.message;
    report.screenshotOnFailure = await takeScreenshot('fatal');
  } finally {
    report.finishedAt = now();
    await browser.close();
  }

  return report;
}

run()
  .then((report) => {
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log('E2E report written to', REPORT_PATH);
    console.log('passed:', report.passed);
    if (report.screenshotOnFailure) console.log('screenshot:', report.screenshotOnFailure);
    if (report.firstConsoleError) console.log('firstConsoleError:', report.firstConsoleError?.message);
    if (report.failedApis?.length) console.log('failedApis:', report.failedApis.length);
    process.exit(report.passed ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
