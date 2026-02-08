/**
 * .env 로드: (1) exe/스크립트 디렉터리 (2) Windows 시 %ProgramData%\doai\node-runner
 * env 파일 복사해 두면 변수로 자동 채워짐. node -r ./load-env.cjs dist-bundle/index.cjs
 */
const path = require('node:path');
const dotenv = require('dotenv');
const dir = __dirname;
dotenv.config({ path: path.join(dir, '.env') });
dotenv.config({ path: path.join(dir, '.env.local'), override: true });
if (process.platform === 'win32') {
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const dataDir = path.join(programData, 'doai', 'node-runner');
  dotenv.config({ path: path.join(dataDir, '.env'), override: true });
  dotenv.config({ path: path.join(dataDir, '.env.local'), override: true });
}
