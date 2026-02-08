/**
 * .env → .env.local 순으로 로드 (없는 파일은 무시)
 * node -r ./load-env.cjs dist-bundle/index.cjs
 */
const path = require('node:path');
const dotenv = require('dotenv');
const dir = __dirname;
dotenv.config({ path: path.join(dir, '.env') });
dotenv.config({ path: path.join(dir, '.env.local'), override: true });
