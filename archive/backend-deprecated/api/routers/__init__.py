"""
DoAi.Me Backend API Routers

라우터 모듈:
- commissions: 작업 위임 관리
- maintenance: 유지보수 작업
- personas: AI 페르소나 관리
- youtube: YouTube 자동화
- wifi: WiFi 자동 연결
- nocturne: 밤의 상징문장 (Nocturne Line)
- laixi: Laixi 로컬 디바이스 제어
"""

from . import commissions, maintenance, personas, youtube, wifi, nocturne, laixi

__all__ = [
    "commissions",
    "maintenance",
    "personas",
    "youtube",
    "wifi",
    "nocturne",
    "laixi",
]

