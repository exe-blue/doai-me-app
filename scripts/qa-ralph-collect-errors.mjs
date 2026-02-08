#!/usr/bin/env node
/**
 * QA Ralph: Visit /, /dashboard, /content, /commands and collect:
 * - First console error (full text + stack)
 * - Failed network requests (url, status)
 * - Page content snapshot on error
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const results = { pages: {}, firstClientError: null, failedRequests: [] };

  const page = await context.newPage();

  // Capture first client-side error with stack
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

  page.on('requestfailed', (req) => {
    results.failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || 'unknown',
    });
  });

  // Note: /command_catalogs is the current route; /commands is not present
  const paths = ['/', '/dashboard', '/content', '/command_catalogs'];
  let currentPath = null;

  page.on('console', (msg) => {
    if (msg.type() === 'error' && currentPath && results.pages[currentPath]) {
      results.pages[currentPath].consoleErrors.push(msg.text());
    }
  });

  for (const path of paths) {
    currentPath = path;
    results.pages[path] = { status: null, consoleErrors: [], hasOverlay: false };
    try {
      const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 12000 });
      results.pages[path].status = res?.status() ?? null;
      await page.waitForTimeout(2000);
      const overlay = await page.$('[data-nextjs-dialog]');
      results.pages[path].hasOverlay = !!overlay;
      if (overlay) {
        const overlayText = await overlay.textContent();
        results.pages[path].overlayText = overlayText?.slice(0, 500) || '';
      }
    } catch (e) {
      results.pages[path].navigateError = e.message;
    }
  }

  // Try to get the first reported error from page (from Next.js error overlay)
  const lastPage = await context.newPage();
  await lastPage.addInitScript(() => {
    const orig = window.onerror;
    window.onerror = function (message, source, lineno, colno, error) {
      if (typeof window.__reportError === 'function') {
        window.__reportError(String(message), error?.stack || `${source}:${lineno}:${colno}`);
      }
      if (orig) return orig.apply(this, arguments);
      return false;
    };
  });
  await lastPage.exposeFunction('__reportError', (msg, stack) => {
    if (!results.firstClientError) results.firstClientError = { message: msg, stack: stack || '' };
  });
  await lastPage.goto(BASE + '/content', { waitUntil: 'networkidle', timeout: 15000 });
  await lastPage.waitForTimeout(3000);
  const overlay = await lastPage.$('[data-nextjs-dialog]');
  if (overlay) {
    const text = await overlay.textContent();
    results.overlayContent = text?.slice(0, 2000) || '';
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
