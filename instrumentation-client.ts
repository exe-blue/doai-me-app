// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

function getIntegrations() {
  try {
    return [Sentry.replayIntegration()];
  } catch {
    return [];
  }
}

try {
  Sentry.init({
    dsn: "https://00976bcdde309a218c366517b0ff4925@o4510426212007936.ingest.us.sentry.io/4510850578513920",

    integrations: getIntegrations(),

    tracesSampleRate: 1,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    sendDefaultPii: true,
  });
} catch (e) {
  console.warn("[Sentry] Init failed, app will continue without error reporting:", e);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
