"""
Shared 모듈

공용 라이브러리, 클라이언트, 스키마
"""

# Laixi Client는 websockets 없이도 import 가능
from .laixi_client import LaixiClient, LaixiConfig, get_laixi_client

# Supabase Client는 선택적 (supabase 패키지 필요)
try:
    from .supabase_client import get_client, DeviceSync, JobSync
    HAS_SUPABASE = True
except ImportError:
    # supabase 미설치 시 None으로 대체
    get_client = None
    DeviceSync = None
    JobSync = None
    HAS_SUPABASE = False

__all__ = [
    # Laixi Client
    'LaixiClient', 
    'LaixiConfig', 
    'get_laixi_client',
    # Supabase Client (선택적)
    'get_client',
    'DeviceSync',
    'JobSync',
    'HAS_SUPABASE',
]
