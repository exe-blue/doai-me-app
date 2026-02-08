/**
 * Node/worker auth: single secret for X-Node-Auth and Authorization: Bearer.
 * Production can set WORKER_SECRET_TOKEN or WORKER_TOKEN; otherwise NODE_AGENT_SHARED_SECRET.
 */

import { NextRequest } from 'next/server';

/** Single secret for node/worker auth. Set one: NODE_SHARED_SECRET (MVP) or WORKER_SECRET_TOKEN or NODE_AGENT_SHARED_SECRET. */
export function getNodeAuthSecret(): string | undefined {
  return (
    process.env.NODE_SHARED_SECRET ||
    process.env.NODE_AGENT_SHARED_SECRET ||
    process.env.WORKER_SECRET_TOKEN ||
    process.env.WORKER_TOKEN
  );
}

export function verifyNodeAuth(req: NextRequest): boolean {
  const secret = getNodeAuthSecret();
  const auth = req.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const header = token ?? req.headers.get('X-Node-Auth');
  return !!secret && !!header && secret === header;
}
