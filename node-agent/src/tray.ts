/**
 * DoAi.Me MVP — Tray App (Windows).
 * Menu: "콘솔/로그 열기" (open log folder), "프로그램 종료" (exit).
 * Uses systray (Go binary); fallback: run main loop only + node-notifier for "설정 누락".
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config, validateRequiredKeys } from './config.js';
import { logError, logInfo } from './logger.js';
import notifier from 'node-notifier';

const TRAY_ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo2NzI0QkUxNUVEMjA2ODExODhDNkYyODE1REEzQzU1NSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpBM0I0RkI2NjNBQTgxMUUyQjJDQTk3QkQzNDQxRUYzMiIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpBM0I0RkI2NTNBQTgxMUUyQjJDQTk3QkQzNDQxRUYzMiIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M1IE1hY2ludG9zaCI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkU2ODE0QzZBRUUyMDY4MTE4OEM2RjI4MTVEQTNDNTU1IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjY3MjRCRTE1RUQyMDY4MTE4OEM2RjI4MTVEQTNDNTU1Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+Xe014gAAAO5JREFUeNrEV81vVUUYPfPj/up7r6VtCtg0vhaDaYwuBOKGuHDhBjUYE11gjNFo4sq4MzHxb3BnXLFi4UZCjAvjRjQlEUEUpCSkCFgKKRQKbenru+/OnfHMva+lRGNJ7kt4yffunTszd853vvN9M1c45/A4f3qrAeLZN//rsaJ9Rtvrh9CO07741yhr4S5887/vl1tCNAbwLG024EPaiJDykOpvvAshnmf7jaLPdsdwXv9Af3UGxieauHZjvnBT8C/nAtbacTav0Q7LOBZc9Hq+vNIUcQQZaPiwStouzq0MYPdTu5CHEXaP7kCoNf6avzU2c/nqJNL0IF0tvBVJDB2G3wklf4AU044gkzBEo9HYEoDcOgIGpLqwWhIrLvQ1tD5YhN6zkaZkhvdKvkrPj+QmD0Kl8MzoE1D+eWUR8h2GYpqavoind44EnTQbRdqB995TnXcyBEmCiB5nuak34kQ8OTyEqBuKygC6vyg15sCfFy99IK1twuTYEEUQINAB+gmiFoUT9Sg6Gih1mEt/z95W5RDw9zZtSgpxFEodsH7OOrW8KuoiUJIRkNCK3Au8wh6fe7/QPuoFgI9p+3x2gY4jdaV1MWgPgGasRJoJOFu+kt3P0d6rHIKVVN9YWuOrOg71yGFyTFNcDidnsmJ2KFVRl/aMS/RFwK175L0jsNohURBXKgM4tPfvmeCFNTSHFSZ3DqM5XnPHflrFW5/PCdQVGVCUhMT7LyV4bZ/E7YUMc/dSzC44XF905yoD+OTlm+egt9HJQQq/jy73Cak4TcwWnvuwB1pQi3VIHWFksI3tQ23smaD+TGu6MoDU7LgsXJ1FvSEhayxGNaadfaABCjAkC1FcZyNBJkJqxZs2cOG1sHIdCIZmoeIl6IFBoWpkoB9B3FnvpfoVQg+iAOBZCOD4zAlxmyBmq9cBmdyk51eEbgzSmPeD9HZtI398CvoQxDH7FDcfTfFRE6xCl51Qi9UrYTCQQYaX6P2eAoDaRm9Xi1LgM9PnPwsPomSAjTqEZoUswpPPCBfZ6nVAUXgy+oNhgPD3XCSMBiBlOdXX+1IDBKf92ITgIu4d0Rl/rc6A8i+RZ3nj6fBgEIQNNmWxH0jRZSBooBgjA39lR3gewlXfDf2CfOl53i2V269FGPj0K6d6IiK2g5ALk/syOeQCQZwvwPSgFHtP5+CyC7BUf75GAOkDAD4E3PkixcrIfud8vc4JWCxs5GolAI4vdsZy4z/t8lWW5GXEqsW4y4IQgTILIsHMMDTbJojs12IvdrY6AJdnpZnWlDPLBHAXfWKFJ54ugEKErAfuPgGscGzLM3GCE1BY5TpgVtehnHa2cx/C1H1161sHAA+A2WC5uD/AmrU7RHGmZ8dyl6+s315F7s5atPcrq5Fs6IsAKHqRL3eZSn8jsTd6BgDZvY1Tvj+YONvar4RGrF2peoZASwIwSzwts/xbc7ynHyaWnm2i40dh5adCBTwDWpQlzzPA+5xZmlOszv38KOp/9BBk85ubp7jJzJGBsXpoSgDC74YGiqHi+peoht97yoDLFjY3F3NnTvIUNFaPkvJ8QG99DRD5XY51JxiMVm8BmPmH284cgWm/WIub24F6kcmhbFEDd864XH/lis/GHgJ4OJ7+3hyDXthVC4dfZ/sdPmgrYb6Ea3/rUGuXYx79i1s87s/zfwQYAOBu3WMkV4BvAAAAAElFTkSuQmCC';

/** Log directory: %ProgramData%\doai\node-runner\logs (or equivalent). */
export function getLogDir(): string {
  const base =
    process.platform === 'win32'
      ? process.env.PROGRAMDATA || String.raw`C:\ProgramData`
      : process.env.HOME || '/tmp';
  return path.join(base, 'doai', 'node-runner', 'logs');
}

function ensureLogDir(): string {
  const dir = getLogDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Open log folder in default file manager. */
function openLogFolder(): void {
  const dir = ensureLogDir();
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', dir], { shell: true, stdio: 'ignore' });
  } else {
    spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [dir], { stdio: 'ignore' });
  }
}

function showConfigMissingNotification(missing: string[]): void {
  const msg = '설정 누락: ' + missing.join(', ') + ' 등 확인';
  logError('Config validation failed: missing ' + missing.join(', '), undefined, {});
  notifier.notify({
    title: 'DoAI Node Runner',
    message: msg,
    sound: false,
  });
}

/** Run tray + main loop. Exported for index.ts --tray entry. Windows only for tray icon; else just run main loop. */
export async function runTray(mainLoop: () => Promise<void>): Promise<void> {
  const missing = validateRequiredKeys();
  if (missing.length > 0) {
    showConfigMissingNotification(missing);
    if (process.platform !== 'win32') {
      return;
    }
    try {
      const SysTray = (await import('systray')).default;
      const systray = new SysTray({
        menu: {
          icon: TRAY_ICON_BASE64,
          title: 'DoAI Runner',
          tooltip: '설정 누락: ' + missing.join(', '),
          items: [
            { title: '콘솔/로그 열기', tooltip: '로그 폴더 열기', checked: false, enabled: true },
            { title: '프로그램 종료', tooltip: '종료', checked: false, enabled: true },
          ],
        },
        copyDir: path.dirname(process.execPath),
      });
      systray.onClick((action) => {
        if (action.seq_id === 0) openLogFolder();
        else if (action.seq_id === 1) systray.kill(true);
      });
    } catch (e) {
      logError('Tray failed (run headless)', e as Error, {});
      process.exit(1);
    }
    return;
  }

  if (process.platform !== 'win32') {
    await mainLoop();
    return;
  }

  try {
    const SysTray = (await import('systray')).default;
    const systray = new SysTray({
      menu: {
        icon: TRAY_ICON_BASE64,
        title: 'DoAI Runner',
        tooltip: `DoAI Node Runner (${config.nodeId})`,
        items: [
          { title: '콘솔/로그 열기', tooltip: '로그 폴더 열기', checked: false, enabled: true },
          { title: '프로그램 종료', tooltip: '종료', checked: false, enabled: true },
        ],
      },
      copyDir: path.dirname(process.execPath),
    });
    systray.onClick((action) => {
      if (action.seq_id === 0) openLogFolder();
      else if (action.seq_id === 1) systray.kill(true);
    });
    logInfo('Tray started', { node_id: config.nodeId });
    await mainLoop();
  } catch (e) {
    logError('Tray failed', e as Error, { node_id: config.nodeId });
    await mainLoop();
  }
}
