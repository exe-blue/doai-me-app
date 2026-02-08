/**
 * .env.local 우선: (1) exe/스크립트 디렉터리 (2) Windows 시 %ProgramData%\doai\node-runner
 * .env.local에 사전 설정값 모두 두고 이 파일만 따르면 됨. node -r ./load-env.cjs dist-bundle/index.cjs
 */
const path = require('node:path');
const dotenv = require('dotenv');
const dir = __dirname;
// .env 먼저 (기본값), .env.local로 덮어써서 최종 적용
dotenv.config({ path: path.join(dir, '.env') });
dotenv.config({ path: path.join(dir, '.env.local'), override: true });
if (process.platform === 'win32') {
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const dataDir = path.join(programData, 'doai', 'node-runner');
  dotenv.config({ path: path.join(dataDir, '.env') });
  dotenv.config({ path: path.join(dataDir, '.env.local'), override: true });
}
