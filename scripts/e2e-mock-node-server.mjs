#!/usr/bin/env node
/**
 * 서버 단위 테스트 (옵션): mock node-runner로 pull → callback 흉내.
 * lease/멱등 동작 확인. 노드 없이 서버만 있으면 실행 가능.
 *
 * 필요: BASE_URL, NODE_AGENT_SHARED_SECRET (env)
 * 사용: BASE_URL=http://localhost:3000 NODE_AGENT_SHARED_SECRET=xxx node scripts/e2e-mock-node-server.mjs
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SECRET = process.env.NODE_AGENT_SHARED_SECRET || '';

const authHeader = SECRET ? { 'X-Node-Auth': SECRET, Authorization: `Bearer ${SECRET}` } : {};

async function main() {
  const report = { pull: null, callback: null, idempotency: null, error: null };

  if (!SECRET) {
    const res = await fetch(`${BASE}/api/nodes/pull?node_id=MOCK-NODE`, { headers: authHeader });
    report.pull = { status: res.status, unauthorizedExpected: res.status === 401 };
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.pull.unauthorizedExpected ? 0 : 1);
    return;
  }

  try {
    // 1) Pull (할당된 job 없을 수 있음)
    const pullRes = await fetch(`${BASE}/api/nodes/pull?node_id=MOCK-NODE`, { headers: authHeader });
    const pullData = await pullRes.json().catch(() => ({}));
    report.pull = { status: pullRes.status, jobsCount: (pullData.jobs || []).length };

    const job = (pullData.jobs || [])[0];
    if (!job) {
      console.log(JSON.stringify(report, null, 2));
      process.exit(pullRes.ok ? 0 : 1);
      return;
    }

    const { run_id, device_index, device_id, lease, step_index, step_id, step_type } = job;
    const leaseToken = lease?.token;
    const runtime_handle = job.runtime_handle ?? device_id;

    // 2) Callback task_started
    const startedPayload = {
      event_id: `e2e-task_started-${run_id}-${device_index}-${Date.now()}`,
      type: 'task_started',
      payload: {
        run_id,
        node_id: 'MOCK-NODE',
        device_id,
        device_index,
        runtime_handle,
        lease_token: leaseToken,
      },
    };
    const cb1 = await fetch(`${BASE}/api/nodes/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(startedPayload),
    });
    report.callback = { task_started: cb1.status };

    // 3) Callback task_finished (멱등: 같은 event_id로 한 번 더 보내도 200)
    const eventIdFinished = `e2e-task_finished-${run_id}-${device_index}-${Date.now()}`;
    const finishedPayload = {
      event_id: eventIdFinished,
      type: 'task_finished',
      payload: {
        run_id,
        node_id: 'MOCK-NODE',
        device_id,
        device_index,
        runtime_handle,
        lease_token: leaseToken,
        status: 'succeeded',
        timings: { startedAt: Date.now() - 1000, endedAt: Date.now() },
      },
    };
    const cb2 = await fetch(`${BASE}/api/nodes/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(finishedPayload),
    });
    report.callback.task_finished = cb2.status;

    const cb2Again = await fetch(`${BASE}/api/nodes/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(finishedPayload),
    });
    report.idempotency = { same_event_second_call_status: cb2Again.status };
  } catch (e) {
    report.error = e.message;
  }

  console.log(JSON.stringify(report, null, 2));
  const ok = report.pull?.status === 200 && report.callback?.task_finished === 200;
  process.exit(ok ? 0 : 1);
}

main();
