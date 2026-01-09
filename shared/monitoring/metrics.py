"""
📈 DoAi.Me Prometheus 메트릭 정의
Agent 및 Device 모니터링용 메트릭

사용 예:
    from shared.monitoring import agent_tasks_total, active_agents

    # 태스크 완료 시
    agent_tasks_total.labels(agent_type="worker", status="success").inc()

    # 활성 에이전트 수 설정
    active_agents.labels(agent_type="worker").set(10)
"""

from prometheus_client import Counter, Gauge, Histogram, Info

# ===========================================
# Agent 메트릭
# ===========================================

agent_tasks_total = Counter(
    "agent_tasks_total",
    "Total tasks processed by agent",
    ["agent_type", "status"],
)
"""
에이전트가 처리한 총 태스크 수

Labels:
    agent_type: 에이전트 유형 (worker, orchestrator, etc.)
    status: 결과 상태 (success, failure, timeout)
"""

agent_task_duration = Histogram(
    "agent_task_duration_seconds",
    "Task processing duration in seconds",
    ["agent_type"],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0],
)
"""
태스크 처리 시간 분포

Labels:
    agent_type: 에이전트 유형
"""

active_agents = Gauge(
    "active_agents",
    "Number of currently active agents",
    ["agent_type"],
)
"""
현재 활성 에이전트 수

Labels:
    agent_type: 에이전트 유형
"""

# ===========================================
# Device 메트릭 (DoAi.Me 전용)
# ===========================================

device_status = Gauge(
    "device_status",
    "Device status (1=online, 0=offline, -1=error)",
    ["serial_number", "pc_id"],
)
"""
기기 상태

Labels:
    serial_number: ADB 시리얼 번호
    pc_id: 연결된 PC ID
"""

device_tasks_total = Counter(
    "device_tasks_total",
    "Total tasks executed on device",
    ["serial_number", "task_type", "status"],
)
"""
기기에서 실행된 총 태스크 수

Labels:
    serial_number: ADB 시리얼 번호
    task_type: 태스크 유형 (youtube_watch, app_install, etc.)
    status: 결과 상태 (success, failure)
"""

device_battery_level = Gauge(
    "device_battery_level",
    "Device battery level percentage",
    ["serial_number"],
)
"""
기기 배터리 레벨 (0-100)

Labels:
    serial_number: ADB 시리얼 번호
"""

device_task_duration = Histogram(
    "device_task_duration_seconds",
    "Task execution duration on device",
    ["serial_number", "task_type"],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0],
)
"""
기기에서 태스크 실행 시간 분포

Labels:
    serial_number: ADB 시리얼 번호
    task_type: 태스크 유형
"""

# ===========================================
# 시스템 정보
# ===========================================

system_info = Info("system", "System information")
"""
시스템 정보 (버전, 환경 등)

사용 예:
    system_info.info({
        "version": "2.0.0",
        "environment": "production",
        "python_version": "3.11.0"
    })
"""

# ===========================================
# 큐 메트릭
# ===========================================

queue_size = Gauge(
    "queue_size",
    "Current queue size",
    ["queue_name"],
)
"""
큐 현재 크기

Labels:
    queue_name: 큐 이름 (youtube_tasks, device_commands, etc.)
"""

queue_processed_total = Counter(
    "queue_processed_total",
    "Total items processed from queue",
    ["queue_name", "status"],
)
"""
큐에서 처리된 총 아이템 수

Labels:
    queue_name: 큐 이름
    status: 처리 결과 (success, failure)
"""
