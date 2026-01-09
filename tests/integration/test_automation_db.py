"""
YouTube Automation DB 통합 테스트

테스트 대상 테이블:
- persona_youtube_history
- video_assignments
- device_heartbeats
- automation_queue
"""

from datetime import datetime

import pytest

from tests.conftest import SKIP_INTEGRATION_TESTS

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(SKIP_INTEGRATION_TESTS, reason="실제 Supabase 자격 증명 필요"),
]


class TestPersonaYoutubeHistory:
    @pytest.fixture
    def client(self, supabase_client):
        return supabase_client

    @pytest.mark.asyncio
    async def test_insert_idle_watch_record(self, client):
        serial = f"TEST_{datetime.now().timestamp()}"
        record = {"device_serial": serial, "search_keyword": "테스트", "watch_duration_seconds": 30}
        try:
            result = client.table("persona_youtube_history").insert(record).execute()
            assert len(result.data) == 1
            client.table("persona_youtube_history").delete().eq(
                "id", result.data[0]["id"]
            ).execute()
        except Exception as e:
            if (
                "does not exist" in str(e)
                or "Invalid schema" in str(e)
                or "Invalid schema" in str(e)
            ):
                pytest.skip("테이블 또는 스키마 없음")
            raise


class TestVideoAssignments:
    @pytest.fixture
    def client(self, supabase_client):
        return supabase_client

    @pytest.mark.asyncio
    async def test_create_assignment(self, client):
        serial = f"TEST_{datetime.now().timestamp()}"
        record = {"device_serial": serial, "priority": 5, "status": "pending"}
        try:
            result = client.table("video_assignments").insert(record).execute()
            assert result.data[0]["status"] == "pending"
            client.table("video_assignments").delete().eq("id", result.data[0]["id"]).execute()
        except Exception as e:
            if "does not exist" in str(e) or "Invalid schema" in str(e):
                pytest.skip("테이블 없음")
            raise


class TestDeviceHeartbeats:
    @pytest.fixture
    def client(self, supabase_client):
        return supabase_client

    @pytest.mark.asyncio
    async def test_log_heartbeat(self, client):
        serial = f"TEST_{datetime.now().timestamp()}"
        record = {"device_serial": serial, "status": "connected", "battery_level": 80}
        try:
            result = client.table("device_heartbeats").insert(record).execute()
            assert result.data[0]["status"] == "connected"
            client.table("device_heartbeats").delete().eq("id", result.data[0]["id"]).execute()
        except Exception as e:
            if "does not exist" in str(e) or "Invalid schema" in str(e):
                pytest.skip("테이블 없음")
            raise


class TestAutomationQueue:
    @pytest.fixture
    def client(self, supabase_client):
        return supabase_client

    @pytest.mark.asyncio
    async def test_add_task(self, client):
        task = {"task_type": "queue_watch", "priority": 5, "status": "pending"}
        try:
            result = client.table("automation_queue").insert(task).execute()
            assert result.data[0]["task_type"] == "queue_watch"
            client.table("automation_queue").delete().eq("id", result.data[0]["id"]).execute()
        except Exception as e:
            if "does not exist" in str(e) or "Invalid schema" in str(e):
                pytest.skip("테이블 없음")
            raise

    @pytest.mark.asyncio
    async def test_priority_ordering(self, client):
        tasks = [
            {"task_type": "queue_watch", "priority": 3, "status": "pending"},
            {"task_type": "queue_watch", "priority": 10, "status": "pending"},
        ]
        try:
            ids = []
            for t in tasks:
                r = client.table("automation_queue").insert(t).execute()
                ids.append(r.data[0]["id"])

            result = (
                client.table("automation_queue")
                .select("priority")
                .in_("id", ids)
                .order("priority", desc=True)
                .execute()
            )
            priorities = [r["priority"] for r in result.data]
            assert priorities == sorted(priorities, reverse=True)

            for i in ids:
                client.table("automation_queue").delete().eq("id", i).execute()
        except Exception as e:
            if "does not exist" in str(e) or "Invalid schema" in str(e):
                pytest.skip("테이블 없음")
            raise
