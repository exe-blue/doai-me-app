"""
📺 YouTube 채널 모니터 서비스
등록된 YouTube 채널에서 새 영상을 감지하고 video_queue에 추가

왜 이 구조인가?
- N8N 대신 Python APScheduler 사용으로 코드베이스 통합
- RSS 피드를 통한 가벼운 모니터링 (API 쿼터 소모 없음)
- 채널별 설정(좋아요, 댓글 등)을 영상에 자동 상속

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-08
"""

import re
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from loguru import logger
import httpx

from ..db import get_supabase_client


class YouTubeChannelMonitor:
    """
    YouTube 채널 RSS 모니터
    
    기능:
    - 등록된 채널의 RSS 피드 주기적 확인
    - 새 영상 발견 시 video_queue에 자동 추가
    - 채널별 설정(priority, like, comment 등) 상속
    """
    
    # YouTube RSS 피드 URL 템플릿
    RSS_URL_TEMPLATE = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    
    # 채널당 가져올 최대 영상 수
    MAX_VIDEOS_PER_CHANNEL = 5
    
    def __init__(self):
        self.client = get_supabase_client()
        self._http_client: Optional[httpx.AsyncClient] = None
    
    async def _get_http_client(self) -> httpx.AsyncClient:
        """HTTP 클라이언트 싱글톤"""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            )
        return self._http_client
    
    async def close(self):
        """리소스 정리"""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
    
    # =========================================
    # 채널 관리
    # =========================================
    
    async def get_active_channels(self) -> List[Dict[str, Any]]:
        """활성 채널 목록 조회"""
        try:
            result = self.client.table("youtube_channels").select("*").eq(
                "is_active", True
            ).execute()
            
            return result.data or []
        except Exception as e:
            logger.error(f"채널 목록 조회 실패: {e}")
            return []
    
    async def add_channel(
        self,
        channel_id: str,
        channel_name: Optional[str] = None,
        watch_priority: str = "NORMAL",
        min_watch_seconds: int = 30,
        max_watch_seconds: int = 180,
        enable_like: bool = False,
        enable_comment: bool = False,
        enable_subscribe: bool = False
    ) -> Optional[Dict[str, Any]]:
        """새 채널 등록"""
        try:
            # channel_id 형식 검증 (UC로 시작하는 24자)
            if not channel_id.startswith("UC") or len(channel_id) != 24:
                logger.warning(f"잘못된 channel_id 형식: {channel_id}")
                # 형식이 맞지 않아도 일단 허용 (일부 채널은 다를 수 있음)
            
            data = {
                "channel_id": channel_id,
                "channel_name": channel_name,
                "is_active": True,
                "watch_priority": watch_priority,
                "min_watch_seconds": min_watch_seconds,
                "max_watch_seconds": max_watch_seconds,
                "enable_like": enable_like,
                "enable_comment": enable_comment,
                "enable_subscribe": enable_subscribe
            }
            
            result = self.client.table("youtube_channels").upsert(
                data,
                on_conflict="channel_id"
            ).execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"채널 등록: {channel_id} ({channel_name})")
                return result.data[0]
            
            return None
        except Exception as e:
            logger.error(f"채널 등록 실패: {e}")
            return None
    
    async def remove_channel(self, channel_id: str) -> bool:
        """채널 비활성화 (삭제 대신)"""
        try:
            result = self.client.table("youtube_channels").update({
                "is_active": False
            }).eq("channel_id", channel_id).execute()
            
            return result.data is not None and len(result.data) > 0
        except Exception as e:
            logger.error(f"채널 비활성화 실패: {e}")
            return False
    
    # =========================================
    # RSS 파싱
    # =========================================
    
    async def fetch_channel_rss(self, channel_id: str) -> Optional[str]:
        """채널 RSS 피드 가져오기"""
        try:
            client = await self._get_http_client()
            url = self.RSS_URL_TEMPLATE.format(channel_id=channel_id)
            
            response = await client.get(url)
            
            if response.status_code == 200:
                return response.text
            else:
                logger.warning(f"RSS 가져오기 실패: {channel_id} (status={response.status_code})")
                return None
        except Exception as e:
            logger.error(f"RSS 요청 실패: {channel_id} - {e}")
            return None
    
    def parse_rss(self, xml_content: str, channel_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        RSS XML 파싱하여 영상 정보 추출
        
        Args:
            xml_content: YouTube RSS XML 문자열
            channel_info: 채널 설정 정보 (priority, enable_like 등)
        
        Returns:
            영상 정보 목록
        """
        videos = []
        
        try:
            # video ID 추출
            video_id_pattern = r'<yt:videoId>([^<]+)</yt:videoId>'
            video_ids = re.findall(video_id_pattern, xml_content)
            
            # title 추출 (첫 번째는 채널 이름이므로 skip)
            title_pattern = r'<title>([^<]+)</title>'
            titles = re.findall(title_pattern, xml_content)[1:]  # 첫 번째 skip
            
            # published 추출
            published_pattern = r'<published>([^<]+)</published>'
            published_dates = re.findall(published_pattern, xml_content)
            
            # channel ID 추출 (XML에서)
            channel_id_pattern = r'<yt:channelId>([^<]+)</yt:channelId>'
            channel_id_match = re.search(channel_id_pattern, xml_content)
            channel_id = channel_id_match.group(1) if channel_id_match else channel_info.get("channel_id", "unknown")
            
            # 영상 정보 구성
            for i in range(min(self.MAX_VIDEOS_PER_CHANNEL, len(video_ids))):
                video_id = video_ids[i]
                title = titles[i] if i < len(titles) else "Unknown"
                published = published_dates[i] if i < len(published_dates) else None
                
                videos.append({
                    "video_id": video_id,
                    "video_url": f"https://www.youtube.com/watch?v={video_id}",
                    "title": title,
                    "channel_id": channel_id,
                    "published_at": published,
                    # 채널 설정 상속
                    "priority": channel_info.get("watch_priority", "NORMAL"),
                    "min_watch_seconds": channel_info.get("min_watch_seconds", 30),
                    "max_watch_seconds": channel_info.get("max_watch_seconds", 180),
                    "enable_like": channel_info.get("enable_like", False),
                    "enable_comment": channel_info.get("enable_comment", False),
                    "enable_subscribe": channel_info.get("enable_subscribe", False),
                    "status": "PENDING"
                })
            
            return videos
            
        except Exception as e:
            logger.error(f"RSS 파싱 실패: {e}")
            return []
    
    # =========================================
    # Video Queue 관리
    # =========================================
    
    async def add_to_queue(self, video: Dict[str, Any]) -> bool:
        """
        영상을 video_queue에 추가 (중복 무시)
        
        Args:
            video: 영상 정보 딕셔너리
        
        Returns:
            성공 여부
        """
        try:
            # 중복 체크
            existing = self.client.table("video_queue").select("id").eq(
                "video_id", video["video_id"]
            ).execute()
            
            if existing.data and len(existing.data) > 0:
                logger.debug(f"이미 존재하는 영상: {video['video_id']}")
                return False
            
            # 새 영상 추가
            result = self.client.table("video_queue").insert({
                "video_id": video["video_id"],
                "video_url": video["video_url"],
                "title": video["title"],
                "channel_id": video["channel_id"],
                "status": video.get("status", "PENDING"),
                "priority": video.get("priority", "NORMAL"),
                "min_watch_seconds": video.get("min_watch_seconds", 30),
                "max_watch_seconds": video.get("max_watch_seconds", 180),
                "enable_like": video.get("enable_like", False),
                "enable_comment": video.get("enable_comment", False),
                "enable_subscribe": video.get("enable_subscribe", False)
            }).execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"영상 큐 추가: {video['title'][:30]}... ({video['video_id']})")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"영상 큐 추가 실패: {video.get('video_id')} - {e}")
            return False
    
    async def get_pending_videos(self, limit: int = 10) -> List[Dict[str, Any]]:
        """대기 중인 영상 목록"""
        try:
            result = self.client.table("video_queue").select("*").eq(
                "status", "PENDING"
            ).order(
                "priority", desc=True  # URGENT > HIGH > NORMAL > LOW
            ).order(
                "created_at", desc=False  # 오래된 것 먼저
            ).limit(limit).execute()
            
            return result.data or []
        except Exception as e:
            logger.error(f"대기 영상 조회 실패: {e}")
            return []
    
    # =========================================
    # 메인 스캔 로직
    # =========================================
    
    async def scan_all_channels(self) -> Dict[str, Any]:
        """
        모든 활성 채널 스캔 및 새 영상 큐 추가
        
        Returns:
            스캔 결과 요약
        """
        logger.info("📺 YouTube 채널 스캔 시작...")
        
        result = {
            "scanned_channels": 0,
            "new_videos": 0,
            "errors": 0,
            "channels": []
        }
        
        try:
            channels = await self.get_active_channels()
            result["scanned_channels"] = len(channels)
            
            if not channels:
                logger.info("활성 채널 없음")
                return result
            
            for channel in channels:
                channel_id = channel.get("channel_id")
                channel_name = channel.get("channel_name", channel_id)
                
                try:
                    # RSS 가져오기
                    xml = await self.fetch_channel_rss(channel_id)
                    
                    if not xml:
                        result["errors"] += 1
                        continue
                    
                    # 파싱
                    videos = self.parse_rss(xml, channel)
                    
                    # 큐에 추가
                    added_count = 0
                    for video in videos:
                        if await self.add_to_queue(video):
                            added_count += 1
                    
                    result["new_videos"] += added_count
                    result["channels"].append({
                        "channel_id": channel_id,
                        "channel_name": channel_name,
                        "videos_found": len(videos),
                        "videos_added": added_count
                    })
                    
                    logger.info(f"  ✓ {channel_name}: {added_count}개 새 영상 추가")
                    
                except Exception as e:
                    logger.error(f"  ✗ {channel_name}: {e}")
                    result["errors"] += 1
                
                # 레이트 리밋 방지
                await asyncio.sleep(0.5)
            
            logger.info(
                f"📺 스캔 완료: {result['scanned_channels']}개 채널, "
                f"{result['new_videos']}개 새 영상, {result['errors']}개 에러"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"채널 스캔 실패: {e}")
            result["errors"] += 1
            return result


# =========================================
# 싱글톤 인스턴스
# =========================================

_monitor: Optional[YouTubeChannelMonitor] = None


def get_youtube_monitor() -> YouTubeChannelMonitor:
    """YouTubeChannelMonitor 싱글톤"""
    global _monitor
    if _monitor is None:
        _monitor = YouTubeChannelMonitor()
    return _monitor


# =========================================
# 스케줄러 통합
# =========================================

_scheduler_running = False


async def youtube_scan_job():
    """스케줄러에서 호출되는 스캔 작업"""
    monitor = get_youtube_monitor()
    await monitor.scan_all_channels()


async def start_youtube_monitor_scheduler(interval_minutes: int = 30):
    """
    YouTube 모니터 스케줄러 시작
    
    Args:
        interval_minutes: 스캔 주기 (분)
    """
    global _scheduler_running
    
    if _scheduler_running:
        logger.warning("YouTube 모니터 스케줄러가 이미 실행 중")
        return
    
    _scheduler_running = True
    logger.info(f"📺 YouTube 모니터 스케줄러 시작 (주기: {interval_minutes}분)")
    
    # 초기 스캔
    await youtube_scan_job()
    
    # 주기적 스캔
    while _scheduler_running:
        await asyncio.sleep(interval_minutes * 60)
        if _scheduler_running:
            await youtube_scan_job()


async def stop_youtube_monitor_scheduler():
    """YouTube 모니터 스케줄러 종료"""
    global _scheduler_running
    _scheduler_running = False
    
    monitor = get_youtube_monitor()
    await monitor.close()
    
    logger.info("📺 YouTube 모니터 스케줄러 종료")


