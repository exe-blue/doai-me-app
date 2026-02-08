# Sentry Example Files Cleanup Instructions

## Issue
The Sentry example files were added by sentry[bot] but serve no purpose in the production application.
These files create actual error reports that clutter the Sentry dashboard.

## Files to Remove

The following files need to be deleted from the repository:

1. **app/api/sentry-example-api/route.ts** - Example API endpoint that throws errors
2. **app/sentry-example-page/page.tsx** - Example page that demonstrates error tracking
3. **lib/sentry-errors.ts** - Custom error classes used only by the example files

## Removal Commands

Run these commands in the repository root to remove the files:

```bash
# Remove the example API route
git rm app/api/sentry-example-api/route.ts
rmdir app/api/sentry-example-api

# Remove the example page
git rm app/sentry-example-page/page.tsx
rmdir app/sentry-example-page

# Remove the error classes library
git rm lib/sentry-errors.ts

# Commit the changes
git commit -m "fix: Remove Sentry example demonstration files

- Remove app/api/sentry-example-api/route.ts
- Remove app/sentry-example-page/page.tsx  
- Remove lib/sentry-errors.ts

These files were demo files that served no purpose in production
and were generating actual error reports in Sentry.

Fixes DOAI-ME-APP-2"

# Push the changes
git push origin main
```

## Verification

After removal, verify that:
1. No files reference `/api/sentry-example-api` 
2. No files reference `/sentry-example-page`
3. No files import from `@/lib/sentry-errors`

Run these commands to verify:
```bash
# Should return no results
grep -r "sentry-example" . --exclude-dir=node_modules --exclude-dir=.git
grep -r "sentry-errors" . --exclude-dir=node_modules --exclude-dir=.git
```

## Why These Files Exist

These files were added by commit `b798b56` on 2026-02-08 by `sentry[bot]`.
They appear to be part of an automated Sentry onboarding/demo process.

## Impact

- **No impact on production functionality** - These are demo files only
- **Positive impact** - Removes clutter from Sentry error reporting
- **No breaking changes** - No other files depend on these

## Date
Created: 2026-02-08