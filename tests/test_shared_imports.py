"""
Shared 모듈 Import 테스트

실행: pytest tests/test_shared_imports.py -v
"""

import pytest


class TestSharedImports:
    """shared 모듈 import 테스트"""
    
    def test_import_laixi_client(self):
        """LaixiClient import 테스트"""
        from shared import LaixiClient, LaixiConfig, get_laixi_client
        
        assert LaixiClient is not None
        assert LaixiConfig is not None
        assert callable(get_laixi_client)
    
    def test_import_supabase_client(self):
        """Supabase Client import 테스트 (선택적)"""
        from shared import get_client, DeviceSync, JobSync, HAS_SUPABASE
        
        if HAS_SUPABASE:
            assert callable(get_client)
            assert DeviceSync is not None
            assert JobSync is not None
        else:
            # supabase 미설치 시 None이어야 함
            pytest.skip("supabase 패키지 미설치")
    
    def test_import_schemas(self):
        """Schemas import 테스트"""
        from shared.schemas import (
            DeviceStatus,
            TaskStatus,
            ExistenceState,
            VideoStatus,
            HumanPatternConfig,
        )
        
        assert DeviceStatus.IDLE == "idle"
        assert TaskStatus.QUEUED == "queued"
        assert ExistenceState.ACTIVE == "active"
        assert VideoStatus.PENDING == "pending"
        assert HumanPatternConfig is not None


class TestSchemaValidation:
    """스키마 유효성 테스트"""
    
    def test_device_create(self):
        """DeviceCreate 스키마 테스트"""
        from shared.schemas import DeviceCreate
        
        device = DeviceCreate(
            serial_number="R3CM40TEST1",
            pc_id="PC-01",
            model="Galaxy S9"
        )
        
        assert device.serial_number == "R3CM40TEST1"
        assert device.pc_id == "PC-01"
    
    def test_task_create(self):
        """TaskCreate 스키마 테스트"""
        from shared.schemas import TaskCreate
        
        task = TaskCreate(
            video_id="test-video-123",
            priority=8
        )
        
        assert task.video_id == "test-video-123"
        assert task.priority == 8
    
    def test_persona_traits_uniqueness(self):
        """PersonaTraits uniqueness 계산 테스트"""
        from shared.schemas import PersonaTraits
        
        # 기본값 (모두 50) - 낮은 고유성
        default_traits = PersonaTraits()
        assert default_traits.calculate_uniqueness() < 0.1
        
        # 극단적인 값 - 높은 고유성
        extreme_traits = PersonaTraits(
            curiosity=100,
            enthusiasm=0,
            skepticism=100,
            empathy=0,
            humor=100,
            expertise=0,
            formality=100,
            verbosity=0
        )
        assert extreme_traits.calculate_uniqueness() > 0.5
    
    def test_video_create(self):
        """VideoCreate 스키마 테스트"""
        from shared.schemas import VideoCreate
        
        video = VideoCreate(
            url="https://youtube.com/watch?v=test123",
            title="테스트 영상",
            keyword="테스트",
            priority=7
        )
        
        assert video.title == "테스트 영상"
        assert video.priority == 7


class TestPatternConfig:
    """패턴 설정 테스트"""
    
    def test_human_pattern_config_defaults(self):
        """HumanPatternConfig 기본값 테스트"""
        from shared.schemas import HumanPatternConfig
        
        config = HumanPatternConfig()
        
        # 시청 패턴 기본값
        assert config.watch.min_watch_seconds == 10
        assert config.watch.full_watch_probability == 0.05
        
        # 터치 패턴 기본값
        assert config.touch.duration_mean == 100
        
        # 스크롤 패턴 기본값
        assert config.scroll.instant_skip_probability == 0.25
    
    def test_watch_pattern_config(self):
        """WatchPatternConfig 커스텀 테스트"""
        from shared.schemas import WatchPatternConfig
        
        config = WatchPatternConfig(
            min_watch_seconds=30,
            full_watch_probability=0.2,
            seek_enabled=False
        )
        
        assert config.min_watch_seconds == 30
        assert config.full_watch_probability == 0.2
        assert config.seek_enabled is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

