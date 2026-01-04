# /admin Dashboard Specification

> 관리자 대시보드 기능 명세서
> **Version:** 1.0.0
> **Last Updated:** 2026-01-04
> **Owner:** @aria (Design), @axon (Implementation)

---

## 📋 개요

DoAi.Me 시스템의 관리자가 노드와 디바이스를 모니터링하고 제어하기 위한 웹 대시보드입니다.

### 목표
1. **실시간 모니터링:** 노드/디바이스 상태를 실시간으로 파악
2. **비상 제어:** 장애 발생 시 신속한 대응 (Emergency API 연동)
3. **최소 기능:** MVP로 핵심 기능만 구현

### 기술 스택
- **Frontend:** Next.js 14+ (App Router)
- **Auth:** Supabase Auth
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** Zustand
- **Real-time:** WebSocket (Orchestrator 연결)

---

## 🔐 인증 (Supabase Auth)

### 로그인 흐름

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   /admin/login  │────▶│  Supabase Auth  │────▶│   /admin        │
│   (Login Page)  │     │   (Verify)      │     │   (Dashboard)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 로그인 페이지 (`/admin/login`)

```typescript
// 스펙
interface LoginPage {
  features: [
    "이메일/비밀번호 로그인",
    "Magic Link 로그인 (선택)",
    "세션 유지 (Remember me)",
    "에러 메시지 표시"
  ];
  
  ui: {
    layout: "중앙 정렬 카드";
    logo: "DoAi.Me 로고";
    inputs: ["email", "password"];
    buttons: ["로그인", "비밀번호 찾기(선택)"];
  };
}
```

### 인증 미들웨어

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createMiddlewareClient({ req: request });
  const { data: { session } } = await supabase.auth.getSession();
  
  // /admin/* 경로는 인증 필수
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }
  
  return NextResponse.next();
}
```

### 허용된 관리자 목록

Supabase에서 관리:
```sql
-- 관리자 테이블
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access"
  ON admin_users FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
```

---

## 📊 대시보드 메인 (`/admin`)

### 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo] DoAi.Me Admin              [User] admin@doai.me [Logout]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐│
│  │ Total Nodes │ │ Online      │ │ Devices     │ │ Active     ││
│  │     5       │ │     4       │ │    120      │ │    85      ││
│  │ ■■■■□       │ │ 🟢 80%     │ │ ■■■■■       │ │ 🟢 71%    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    EMERGENCY CONTROLS                       ││
│  │  [🟢 L1 Soft Reset]  [🟡 L2 Service Reset]  [🔴 L3 Box]   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Nodes                                          [Refresh]   ││
│  │  ───────────────────────────────────────────────────────── ││
│  │  🟢 node-001  Seoul Node 1     20 devices    2s ago        ││
│  │  🟢 node-002  Seoul Node 2     25 devices    5s ago        ││
│  │  🟢 node-003  Busan Node 1     30 devices    3s ago        ││
│  │  🔴 node-004  Busan Node 2     25 devices    5m ago        ││
│  │  🟢 node-005  Incheon Node     20 devices    1s ago        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 컴포넌트 명세

#### 1. Stats Cards (상단 통계)

```typescript
interface StatsCard {
  title: string;
  value: number;
  subtitle: string;
  trend?: "up" | "down" | "stable";
  color: "green" | "yellow" | "red" | "blue";
}

const statsCards: StatsCard[] = [
  { title: "Total Nodes", value: 5, subtitle: "전체 노드", color: "blue" },
  { title: "Online", value: 4, subtitle: "80% 활성", color: "green" },
  { title: "Devices", value: 120, subtitle: "전체 디바이스", color: "blue" },
  { title: "Active", value: 85, subtitle: "71% 활성", color: "green" }
];
```

#### 2. Emergency Controls (비상 버튼)

```typescript
interface EmergencyButton {
  level: "L1" | "L2" | "L3";
  label: string;
  color: "green" | "yellow" | "red";
  confirmRequired: boolean;
  twoStepRequired: boolean;
}

const emergencyButtons: EmergencyButton[] = [
  { 
    level: "L1", 
    label: "Soft Reset", 
    color: "green",
    confirmRequired: false,  // 즉시 실행
    twoStepRequired: false
  },
  { 
    level: "L2", 
    label: "Service Reset", 
    color: "yellow",
    confirmRequired: true,   // 확인 모달
    twoStepRequired: false
  },
  { 
    level: "L3", 
    label: "Box Reset", 
    color: "red",
    confirmRequired: true,   // 확인 모달
    twoStepRequired: true    // 2단계 승인
  }
];
```

#### 3. Nodes List (노드 목록)

```typescript
interface NodeListItem {
  id: string;
  name: string;
  status: "online" | "offline" | "error";
  deviceCount: number;
  lastHeartbeat: Date;
  metrics?: {
    cpu: number;
    memory: number;
  };
}

// 실시간 업데이트: WebSocket으로 heartbeat 수신
```

---

## 🚨 Emergency Controls 상세

### L1 Soft Reset (즉시 실행)

```typescript
// 클릭 시 즉시 API 호출
async function handleL1Reset() {
  const response = await fetch('/api/proxy/emergency/soft-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      target: 'orchestrator',
      reason: 'Manual trigger from admin dashboard'
    })
  });
  
  if (response.ok) {
    toast.success('L1 Soft Reset 시작됨');
  } else {
    toast.error('L1 Reset 실패');
  }
}
```

### L2 Service Reset (1단계 확인)

```typescript
// 확인 모달 표시
function L2ResetModal({ onConfirm, onCancel }) {
  const [confirmCode, setConfirmCode] = useState('');
  const [reason, setReason] = useState('');
  
  return (
    <Modal title="⚠️ Service Reset 확인">
      <Alert variant="warning">
        모든 연결된 노드가 일시적으로 중단됩니다.
        예상 복구 시간: ~2분
      </Alert>
      
      <Input 
        label="확인 코드 (6자리)" 
        value={confirmCode}
        onChange={setConfirmCode}
        placeholder="자동 생성된 코드 입력"
      />
      
      <Textarea
        label="사유"
        value={reason}
        onChange={setReason}
        required
      />
      
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel}>취소</Button>
        <Button 
          variant="warning" 
          onClick={() => onConfirm({ confirmCode, reason })}
          disabled={!confirmCode || !reason}
        >
          실행
        </Button>
      </div>
    </Modal>
  );
}
```

### L3 Box Reset (2단계 승인)

```typescript
// 2단계 승인 프로세스
function L3ResetFlow() {
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState(null);
  
  if (step === 1) {
    return (
      <Modal title="🔴 Box Reset - Step 1/2">
        <Alert variant="destructive">
          서버가 완전히 재시작됩니다.
          모든 연결이 끊기고 복구에 ~10분 소요됩니다.
        </Alert>
        
        <Input label="1차 승인자 이름" required />
        <Input label="1차 승인 코드" required />
        <Textarea label="사유" required />
        
        <Button onClick={() => setStep(2)}>
          다음 (2차 승인 필요)
        </Button>
      </Modal>
    );
  }
  
  return (
    <Modal title="🔴 Box Reset - Step 2/2">
      <Alert>
        1차 승인 완료. 30초 후 2차 승인 가능합니다.
      </Alert>
      
      <Countdown seconds={30} />
      
      <Input label="2차 승인자 이름 (1차와 다른 사람)" required />
      <Input label="2차 승인 코드" required />
      
      <Button variant="destructive" onClick={handleL3Execute}>
        최종 실행
      </Button>
    </Modal>
  );
}
```

---

## 📡 Real-time 연결

### WebSocket Store (Zustand)

```typescript
// stores/websocketStore.ts
interface WebSocketState {
  connected: boolean;
  nodes: Map<string, NodeStatus>;
  lastUpdate: Date | null;
  
  connect: () => void;
  disconnect: () => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  connected: false,
  nodes: new Map(),
  lastUpdate: null,
  
  connect: () => {
    const ws = new WebSocket(
      `wss://api.doai.me/ws/dashboard?token=${getAdminToken()}`
    );
    
    ws.onopen = () => set({ connected: true });
    ws.onclose = () => set({ connected: false });
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.method === 'node_status_update') {
        const nodes = get().nodes;
        nodes.set(message.params.node_id, message.params);
        set({ nodes: new Map(nodes), lastUpdate: new Date() });
      }
    };
  },
  
  disconnect: () => {
    // cleanup
  }
}));
```

### Dashboard WebSocket 엔드포인트

Orchestrator에 추가 필요:
```python
# /ws/dashboard - 관리자 대시보드용
@router.websocket("/ws/dashboard")
async def dashboard_websocket(
    websocket: WebSocket,
    token: str = Query(...)
):
    # ORCH_ADMIN_TOKEN 검증
    if token != settings.ORCH_ADMIN_TOKEN:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    await websocket.accept()
    
    # 노드 상태 브로드캐스트 구독
    async for message in node_status_broadcast:
        await websocket.send_json(message)
```

---

## 🎨 UI/UX 가이드

### 색상 팔레트

```css
:root {
  /* Status Colors */
  --status-online: #22c55e;   /* green-500 */
  --status-offline: #ef4444;  /* red-500 */
  --status-warning: #f59e0b;  /* amber-500 */
  --status-idle: #6b7280;     /* gray-500 */
  
  /* Emergency Button Colors */
  --emergency-l1: #22c55e;    /* green */
  --emergency-l2: #f59e0b;    /* yellow/amber */
  --emergency-l3: #ef4444;    /* red */
  
  /* Background */
  --bg-primary: #0f172a;      /* slate-900 */
  --bg-secondary: #1e293b;    /* slate-800 */
  --bg-card: #334155;         /* slate-700 */
}
```

### 반응형 브레이크포인트

```typescript
const breakpoints = {
  sm: '640px',   // 모바일
  md: '768px',   // 태블릿
  lg: '1024px',  // 데스크톱
  xl: '1280px',  // 와이드
};

// 모바일에서는 통계 카드 2열, 데스크톱에서 4열
```

### 접근성

- 모든 버튼에 `aria-label`
- 키보드 네비게이션 지원
- 고대비 모드 지원
- 스크린 리더 호환

---

## 📁 폴더 구조

```
apps/web/
├── app/
│   ├── admin/
│   │   ├── layout.tsx          # Admin 레이아웃
│   │   ├── page.tsx            # 대시보드 메인
│   │   ├── login/
│   │   │   └── page.tsx        # 로그인 페이지
│   │   └── nodes/
│   │       └── [id]/
│   │           └── page.tsx    # 노드 상세 (선택)
│   └── api/
│       └── proxy/
│           └── [...path]/
│               └── route.ts    # API 프록시
├── components/
│   ├── admin/
│   │   ├── StatsCard.tsx
│   │   ├── EmergencyControls.tsx
│   │   ├── NodesList.tsx
│   │   └── LoginForm.tsx
│   └── ui/                     # shadcn/ui
├── stores/
│   ├── authStore.ts
│   └── websocketStore.ts
├── lib/
│   ├── supabase.ts
│   └── api.ts
└── middleware.ts
```

---

## 🚀 구현 우선순위

### Phase 1: MVP (1주)
1. [ ] Supabase Auth 연동 (로그인/로그아웃)
2. [ ] 대시보드 레이아웃
3. [ ] 노드 목록 표시 (REST API)
4. [ ] L1 Emergency Button

### Phase 2: Real-time (1주)
5. [ ] WebSocket 연결
6. [ ] 실시간 노드 상태 업데이트
7. [ ] L2/L3 Emergency Modal

### Phase 3: Polish (3일)
8. [ ] 에러 핸들링
9. [ ] 로딩 상태
10. [ ] 모바일 반응형

---

## 🔗 관련 문서

- [API Spec](./api.md)
- [Architecture](./architecture.md)
- [Recovery Runbook](../orion/runbooks/recover.md)
- [Axon Handoff](../orion/handoffs/to-axon.md)

