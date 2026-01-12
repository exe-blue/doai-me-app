"""
🧪 Metrics 단위 테스트
shared/monitoring/metrics.py 테스트
"""

import pytest


class TestAgentMetrics:
    """Agent 메트릭 테스트"""

    def test_agent_tasks_counter_increment(self):
        """태스크 카운터 증가 테스트"""
        from shared.monitoring import agent_tasks_total

        # 초기값 저장
        initial = agent_tasks_total.labels(
            agent_type="test_worker", status="success"
        )._value.get()

        # 증가
        agent_tasks_total.labels(agent_type="test_worker", status="success").inc()

        # 검증
        current = agent_tasks_total.labels(
            agent_type="test_worker", status="success"
        )._value.get()
        assert current == initial + 1

    def test_agent_tasks_counter_with_different_labels(self):
        """다른 레이블로 카운터 증가"""
        from shared.monitoring import agent_tasks_total

        agent_tasks_total.labels(agent_type="orchestrator", status="failure").inc()
        agent_tasks_total.labels(agent_type="orchestrator", status="success").inc(5)

        # 각 레이블 조합이 독립적으로 카운트됨
        failure_count = agent_tasks_total.labels(
            agent_type="orchestrator", status="failure"
        )._value.get()
        success_count = agent_tasks_total.labels(
            agent_type="orchestrator", status="success"
        )._value.get()

        assert failure_count >= 1
        assert success_count >= 5

    def test_active_agents_gauge(self):
        """활성 에이전트 게이지 테스트"""
        from shared.monitoring import active_agents

        # 값 설정
        active_agents.labels(agent_type="worker").set(10)
        assert active_agents.labels(agent_type="worker")._value.get() == 10

        # 증가
        active_agents.labels(agent_type="worker").inc()
        assert active_agents.labels(agent_type="worker")._value.get() == 11

        # 감소
        active_agents.labels(agent_type="worker").dec()
        assert active_agents.labels(agent_type="worker")._value.get() == 10

    def test_agent_task_duration_histogram(self):
        """태스크 시간 히스토그램 테스트"""
        from shared.monitoring import agent_task_duration

        # 시간 기록
        agent_task_duration.labels(agent_type="worker").observe(0.5)
        agent_task_duration.labels(agent_type="worker").observe(1.2)
        agent_task_duration.labels(agent_type="worker").observe(5.0)

        # 히스토그램은 _sum과 _count로 확인
        assert agent_task_duration.labels(agent_type="worker")._sum.get() >= 6.7


class TestDeviceMetrics:
    """Device 메트릭 테스트"""

    def test_device_status_gauge(self):
        """기기 상태 게이지 테스트"""
        from shared.monitoring import device_status

        # online (1)
        device_status.labels(serial_number="TEST001", pc_id="1").set(1)
        assert device_status.labels(serial_number="TEST001", pc_id="1")._value.get() == 1

        # offline (0)
        device_status.labels(serial_number="TEST001", pc_id="1").set(0)
        assert device_status.labels(serial_number="TEST001", pc_id="1")._value.get() == 0

    def test_device_tasks_counter(self):
        """기기 태스크 카운터 테스트"""
        from shared.monitoring import device_tasks_total

        device_tasks_total.labels(
            serial_number="TEST001",
            task_type="youtube_watch",
            status="success",
        ).inc()

        count = device_tasks_total.labels(
            serial_number="TEST001",
            task_type="youtube_watch",
            status="success",
        )._value.get()

        assert count >= 1


class TestSystemMetrics:
    """시스템 메트릭 테스트"""

    def test_system_info(self):
        """시스템 정보 테스트"""
        from shared.monitoring import system_info

        system_info.info(
            {
                "version": "2.0.0",
                "environment": "test",
                "python_version": "3.11",
            }
        )

        # Info 메트릭은 _value가 딕셔너리
        # 에러 없이 설정되면 성공
        assert True


class TestQueueMetrics:
    """큐 메트릭 테스트"""

    def test_queue_size_gauge(self):
        """큐 크기 게이지 테스트"""
        from shared.monitoring.metrics import queue_size

        queue_size.labels(queue_name="youtube_tasks").set(100)
        assert queue_size.labels(queue_name="youtube_tasks")._value.get() == 100

    def test_queue_processed_counter(self):
        """큐 처리 카운터 테스트"""
        from shared.monitoring.metrics import queue_processed_total

        queue_processed_total.labels(queue_name="device_commands", status="success").inc(
            50
        )

        count = queue_processed_total.labels(
            queue_name="device_commands", status="success"
        )._value.get()

        assert count >= 50
