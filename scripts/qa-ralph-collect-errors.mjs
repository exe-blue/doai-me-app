#!/usr/bin/env node
/**
 * QA Ralph: Visit /, /dashboard, /commands, /content and collect:
 * - status, consoleErrors, overlayText, failedRequests per page
 * - BASE_URL from env (use Vercel preview/prod for CI)
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

const PATHS = ['/', '/dashboard', '/commands', '/content'];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const results = {
    baseUrl: BASE,
    pages: {},
    firstClientError: null,
    failedRequests: [],
  };

  const page = await context.newPage();

  await page.exposeFunction('__reportError', (msg, stack) => {
    if (!results.firstClientError) results.firstClientError = { message: msg, stack: stack || '' };
  });
  await page.addInitScript(() => {
    const orig = window.onerror;
    window.onerror = function (message, source, lineno, colno, error) {
      if (typeof window.__reportError === 'function') {
        window.__reportError(String(message), error?.stack || `${source}:${lineno}:${colno}`);
      }
      if (orig) return orig.apply(this, arguments);
      return false;
    };
    window.addEventListener('unhandledrejection', (e) => {
      const err = e.reason;
      if (typeof window.__reportError === 'function') {
        window.__reportError(String(err?.message || err), err?.stack || '');
      }
    });
  });

  const requestFailures = [];
  page.on('requestfailed', (req) => {
    requestFailures.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || 'unknown',
    });
  });

  for (const path of PATHS) {
    results.pages[path] = {
      status: null,
      consoleErrors: [],
      overlayText: null,
      hasOverlay: false,
      failedRequests: [],
    };
    const pageResults = results.pages[path];
    requestFailures.length = 0;
    const consoleErrors = [];
    const consoleListener = (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    };
    page.on('console', consoleListener);

    try {
      const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 12000 });
      pageResults.status = res?.status() ?? null;
      await page.waitForTimeout(2000);

      const overlay = await page.$('[data-nextjs-dialog]');
      pageResults.hasOverlay = !!overlay;
      if (overlay) {
        pageResults.overlayText = (await overlay.textContent())?.slice(0, 500) || null;
      }

      pageResults.failedRequests = [...requestFailures];
      pageResults.consoleErrors = [...consoleErrors];
    } catch (e) {
      pageResults.navigateError = e.message;
      pageResults.failedRequests = [...requestFailures];
      pageResults.consoleErrors = [...consoleErrors];
    }

    page.off('console', consoleListener);
  }

  await browser.close();
  return results;
}

run()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
