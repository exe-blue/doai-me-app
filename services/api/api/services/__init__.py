"""
DoAi.Me Backend Services

서비스 모듈:
- laixi_client: Laixi WebSocket 클라이언트
- wifi_service: WiFi 자동 연결 서비스
- persona_search_service: 페르소나 IDLE 검색 서비스 (P1)
- corruption_engine: 타락 엔진
- decision_engine: 의사결정 엔진
- maintenance_engine: 유지보수 엔진
- supabase_rpc: Supabase RPC 클라이언트
"""

from .laixi_client import LaixiClient, get_laixi_client
from .wifi_service import WifiService, get_wifi_service
from .persona_search_service import PersonaSearchService, get_persona_search_service

__all__ = [
    "LaixiClient",
    "get_laixi_client",
    "WifiService",
    "get_wifi_service",
    "PersonaSearchService",
    "get_persona_search_service",
]

