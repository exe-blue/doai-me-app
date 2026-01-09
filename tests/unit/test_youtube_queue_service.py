"""
YouTubeQueueService 단위 테스트

테스트 대상 (정적 메서드):
- calculate_like_probability() - 조회수 기반 좋아요 확률
- calculate_comment_probability() - 조회수 기반 댓글 확률
- should_like() - 좋아요 여부 결정
- should_comment() - 댓글 여부 결정
- calculate_watch_percent() - 시청률 계산
"""

import pytest
from unittest.mock import patch

from shared.youtube_queue_service import YouTubeQueueService


class TestCalculateLikeProbability:
    """좋아요 확률 계산 테스트"""
    
    def test_default_probability_no_views(self):
        """조회수 없을 때 기본 확률"""
        prob = YouTubeQueueService.calculate_like_probability(0.20, None)
        assert prob == 0.20
    
    def test_low_views_double_probability(self):
        """저조회수 (< 1000): 2배"""
        prob = YouTubeQueueService.calculate_like_probability(0.20, 500)
        assert prob == 0.40
        
        prob = YouTubeQueueService.calculate_like_probability(0.20, 0)
        assert prob == 0.40
        
        prob = YouTubeQueueService.calculate_like_probability(0.20, 999)
        assert prob == 0.40
    
    def test_medium_views_1_5x_probability(self):
        """중간 조회수 (1000-10000): 1.5배"""
        prob = YouTubeQueueService.calculate_like_probability(0.20, 1000)
        assert prob == pytest.approx(0.30)
        
        prob = YouTubeQueueService.calculate_like_probability(0.20, 5000)
        assert prob == pytest.approx(0.30)
        
        prob = YouTubeQueueService.calculate_like_probability(0.20, 9999)
        assert prob == pytest.approx(0.30)
    
    def test_high_views_base_probability(self):
        """고조회수 (>= 10000): 기본 확률"""
        prob = YouTubeQueueService.calculate_like_probability(0.20, 10000)
        assert prob == 0.20
        
        prob = YouTubeQueueService.calculate_like_probability(0.20, 100000)
        assert prob == 0.20
        
        prob = YouTubeQueueService.calculate_like_probability(0.20, 1000000)
        assert prob == 0.20
    
    def test_probability_cap_at_1(self):
        """확률 최대값 1.0 제한"""
        # 60% 기본 확률 * 2배 = 120% -> 100%로 제한
        prob = YouTubeQueueService.calculate_like_probability(0.60, 100)
        assert prob <= 1.0
    
    def test_different_base_probabilities(self):
        """다양한 기본 확률 테스트"""
        # 10% 기본
        prob = YouTubeQueueService.calculate_like_probability(0.10, 500)
        assert prob == 0.20
        
        # 30% 기본
        prob = YouTubeQueueService.calculate_like_probability(0.30, 5000)
        assert prob == pytest.approx(0.45)


class TestCalculateCommentProbability:
    """댓글 확률 계산 테스트"""
    
    def test_default_probability_no_views(self):
        """조회수 없을 때 기본 확률"""
        prob = YouTubeQueueService.calculate_comment_probability(0.05, None)
        assert prob == 0.05
    
    def test_low_views_double_probability(self):
        """저조회수: 2배"""
        prob = YouTubeQueueService.calculate_comment_probability(0.05, 500)
        assert prob == 0.10
    
    def test_medium_views_1_5x_probability(self):
        """중간 조회수: 1.5배"""
        prob = YouTubeQueueService.calculate_comment_probability(0.05, 5000)
        assert prob == pytest.approx(0.075)
    
    def test_high_views_base_probability(self):
        """고조회수: 기본 확률"""
        prob = YouTubeQueueService.calculate_comment_probability(0.05, 50000)
        assert prob == 0.05


class TestShouldLike:
    """좋아요 여부 결정 테스트"""
    
    def test_should_like_100_percent_logged_in(self):
        """100% 확률 + 로그인 = True"""
        result = YouTubeQueueService.should_like(1.0, is_logged_in=True)
        assert result is True
    
    def test_should_like_0_percent_logged_in(self):
        """0% 확률 + 로그인 = False"""
        result = YouTubeQueueService.should_like(0.0, is_logged_in=True)
        assert result is False
    
    def test_should_like_not_logged_in_always_false(self):
        """비로그인 상태 = 항상 False"""
        # 100% 확률이어도 비로그인이면 False
        result = YouTubeQueueService.should_like(1.0, is_logged_in=False)
        assert result is False
        
        result = YouTubeQueueService.should_like(0.5, is_logged_in=False)
        assert result is False
    
    @patch('random.random')
    def test_should_like_probability_check(self, mock_random):
        """확률 기반 결정 테스트"""
        # random() = 0.3이면, 0.5 확률에서 True
        mock_random.return_value = 0.3
        result = YouTubeQueueService.should_like(0.5, is_logged_in=True)
        assert result is True
        
        # random() = 0.7이면, 0.5 확률에서 False
        mock_random.return_value = 0.7
        result = YouTubeQueueService.should_like(0.5, is_logged_in=True)
        assert result is False


class TestShouldComment:
    """댓글 여부 결정 테스트"""
    
    def test_should_comment_100_percent_logged_in(self):
        """100% 확률 + 로그인 = True"""
        result = YouTubeQueueService.should_comment(1.0, is_logged_in=True)
        assert result is True
    
    def test_should_comment_0_percent_logged_in(self):
        """0% 확률 + 로그인 = False"""
        result = YouTubeQueueService.should_comment(0.0, is_logged_in=True)
        assert result is False
    
    def test_should_comment_not_logged_in_always_false(self):
        """비로그인 상태 = 항상 False"""
        result = YouTubeQueueService.should_comment(1.0, is_logged_in=False)
        assert result is False
    
    @patch('random.random')
    def test_should_comment_probability_check(self, mock_random):
        """확률 기반 결정 테스트"""
        mock_random.return_value = 0.03
        result = YouTubeQueueService.should_comment(0.05, is_logged_in=True)
        assert result is True
        
        mock_random.return_value = 0.10
        result = YouTubeQueueService.should_comment(0.05, is_logged_in=True)
        assert result is False


class TestCalculateWatchPercent:
    """시청률 계산 테스트"""
    
    def test_full_watch(self):
        """전체 시청"""
        percent = YouTubeQueueService.calculate_watch_percent(180, 180)
        assert percent == 100.0
    
    def test_partial_watch(self):
        """부분 시청"""
        percent = YouTubeQueueService.calculate_watch_percent(90, 180)
        assert percent == 50.0
        
        percent = YouTubeQueueService.calculate_watch_percent(135, 180)
        assert percent == 75.0
    
    def test_over_watch(self):
        """초과 시청 (광고 등으로 인해 가능)"""
        percent = YouTubeQueueService.calculate_watch_percent(200, 180)
        assert percent > 100.0
    
    def test_zero_target_duration(self):
        """목표 시간이 0인 경우"""
        percent = YouTubeQueueService.calculate_watch_percent(100, 0)
        assert percent == 0.0
    
    def test_zero_watch_duration(self):
        """시청 시간이 0인 경우"""
        percent = YouTubeQueueService.calculate_watch_percent(0, 180)
        assert percent == 0.0


class TestEdgeCases:
    """엣지 케이스 테스트"""
    
    def test_negative_views(self):
        """음수 조회수 (비정상 데이터)"""
        # 음수도 저조회수로 처리
        prob = YouTubeQueueService.calculate_like_probability(0.20, -100)
        assert prob == 0.40
    
    def test_negative_probability(self):
        """음수 확률 (비정상 데이터)"""
        prob = YouTubeQueueService.calculate_like_probability(-0.10, 5000)
        assert prob < 0  # 음수 그대로 반환 (입력 검증은 스키마에서)
    
    def test_very_high_views(self):
        """매우 높은 조회수"""
        prob = YouTubeQueueService.calculate_like_probability(0.20, 1_000_000_000)
        assert prob == 0.20
