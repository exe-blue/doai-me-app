"""
YouTube Automation Queue 처리 통합 테스트

테스트 대상:
- Idle/Queue 태스크 플로우
- 예약 태스크 타이밍
- 태스크 만료
"""

from datetime import datetime, timedelta, timezone

import pytest

from tests.conftest import SKIP_INTEGRATION_TESTS

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(SKIP_INTEGRATION_TESTS, reason="실제 Supabase 자격 증명 필요"),
]


class TestIdleTaskFlow:
    @pytest.fixture
    def client(self, supabase_client):
        return supabase_client

    @pytest.mark.asyncio
    async def test_idle_task_flow(self, client):
        f"IDLE_{datetime.now().timestamp()}"
        task = {
            "task_type": "idle_watch",
            "search_keyword": "테스트",
            "priority": 5,
            "status": "pending",
        }
        try:
            r = client.table("automation_queue").insert(task).execute()
            task_id = r.data[0]["id"]

            client.table("automation_queue").update({"status": "completed"}).eq(
                "id", task_id
            ).execute()
            final = client.table("automation_queue").select("status").eq("id", task_id).execute()
            assert final.data[0]["status"] == "completed"

            client.table("automation_queue").delete().eq("id", task_id).execute()
        except Exception as e:
            if "does not exist" in str(e) or "Invalid schema" in str(e):
                pytest.skip("테이블 없음")
            raise


class TestScheduledTask:
    @pytest.fixture
    def client(self, supabase_client):
        return supabase_client

    @pytest.mark.asyncio
    async def test_scheduled_task_not_available_before_time(self, client):
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        task = {
            "task_type": "scheduled_watch",
            "priority": 5,
            "status": "pending",
            "scheduled_at": future,
        }
        try:
            r = client.table("automation_queue").insert(task).execute()
            task_id = r.data[0]["id"]

            now = datetime.now(timezone.utc).isoformat()
            query = (
                client.table("automation_queue")
                .select("*")
                .eq("id", task_id)
                .or_(f"scheduled_at.is.null,scheduled_at.lte.{now}")
                .execute()
            )
            assert len(query.data) == 0

            client.table("automation_queue").delete().eq("id", task_id).execute()
        except Exception as e:
            if "does not exist" in str(e) or "Invalid schema" in str(e):
                pytest.skip("테이블 없음")
            raise


class TestTaskExpiration:
    @pytest.fixture
    def client(self, supabase_client):
        return supabase_client

    @pytest.mark.asyncio
    async def test_expired_task_not_available(self, client):
        past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        task = {"task_type": "queue_watch", "priority": 5, "status": "pending", "expires_at": past}
        try:
            r = client.table("automation_queue").insert(task).execute()
            task_id = r.data[0]["id"]

            now = datetime.now(timezone.utc).isoformat()
            query = (
                client.table("automation_queue")
                .select("*")
                .eq("id", task_id)
                .or_(f"expires_at.is.null,expires_at.gt.{now}")
                .execute()
            )
            assert len(query.data) == 0

            client.table("automation_queue").delete().eq("id", task_id).execute()
        except Exception as e:
            if "does not exist" in str(e) or "Invalid schema" in str(e):
                pytest.skip("테이블 없음")
            raise
