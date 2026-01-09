"""
🤖 DoAi.Me - Supabase RPC Client
Database Function 호출을 위한 래퍼

왜 이 구조인가?
- 단순한 경제 계산(유지비 차감)은 DB에서 원자적으로 처리 → 동시성 안전
- 복잡한 확률 계산(타락)은 Python에서 처리 후 결과만 DB에 저장
- 600대 기기가 동시에 요청해도 안전
"""

from typing import Optional, Any
from loguru import logger
from db import get_supabase_client


class SupabaseRPC:
    """Supabase Database Function 호출 클래스"""
    
    def __init__(self):
        self.client = get_supabase_client()
    
    async def deduct_maintenance_fee(
        self,
        persona_id: str,
        amount: float
    ) -> dict:
        """
        유지비 차감 (Database Function 호출)
        
        왜 DB Function인가?
        - 동시성 문제 방지 (FOR UPDATE 락)
        - 원자성 보장 (트랜잭션 내 처리)
        - 네트워크 왕복 최소화
        
        Args:
            persona_id: 페르소나 UUID
            amount: 차감할 금액
            
        Returns:
            {success: bool, new_balance: float, message: str}
        """
        try:
            result = self.client.rpc(
                'deduct_maintenance_fee',
                {
                    'p_persona_id': persona_id,
                    'p_amount': amount
                }
            ).execute()
            
            if result.data and len(result.data) > 0:
                row = result.data[0]
                return {
                    'success': row.get('success', False),
                    'new_balance': row.get('new_balance', 0),
                    'message': row.get('message', '')
                }
            
            return {
                'success': False,
                'new_balance': 0,
                'message': 'No response from database function'
            }
            
        except Exception as e:
            logger.error(f"유지비 차감 RPC 실패: {e}")
            return {
                'success': False,
                'new_balance': 0,
                'message': str(e)
            }
    
    async def grant_credit(
        self,
        persona_id: str,
        amount: float,
        reason: str = "의뢰 완료 보상"
    ) -> dict:
        """
        크레딧 지급 (Database Function 호출)
        
        Args:
            persona_id: 페르소나 UUID
            amount: 지급할 금액
            reason: 지급 사유
            
        Returns:
            {success: bool, new_balance: float, message: str}
        """
        try:
            result = self.client.rpc(
                'grant_credit',
                {
                    'p_persona_id': persona_id,
                    'p_amount': amount,
                    'p_reason': reason
                }
            ).execute()
            
            if result.data and len(result.data) > 0:
                row = result.data[0]
                return {
                    'success': row.get('success', False),
                    'new_balance': row.get('new_balance', 0),
                    'message': row.get('message', '')
                }
            
            return {
                'success': False,
                'new_balance': 0,
                'message': 'No response from database function'
            }
            
        except Exception as e:
            logger.error(f"크레딧 지급 RPC 실패: {e}")
            return {
                'success': False,
                'new_balance': 0,
                'message': str(e)
            }
    
    async def run_daily_maintenance(self) -> dict:
        """
        일괄 유지비 차감 (Cron Job용)
        
        Returns:
            {total_personas: int, success_count: int, crisis_count: int, total_deducted: float}
        """
        try:
            result = self.client.rpc('run_daily_maintenance', {}).execute()
            
            if result.data and len(result.data) > 0:
                row = result.data[0]
                return {
                    'total_personas': row.get('total_personas', 0),
                    'success_count': row.get('success_count', 0),
                    'crisis_count': row.get('crisis_count', 0),
                    'total_deducted': row.get('total_deducted', 0)
                }
            
            return {
                'total_personas': 0,
                'success_count': 0,
                'crisis_count': 0,
                'total_deducted': 0
            }
            
        except Exception as e:
            logger.error(f"일괄 유지비 차감 RPC 실패: {e}")
            raise
    
    async def update_corruption_level(
        self,
        persona_id: str,
        new_level: int,
        reason: str
    ) -> bool:
        """
        타락도 업데이트 (복잡한 계산 후 결과 저장)
        
        Args:
            persona_id: 페르소나 UUID
            new_level: 새 타락도 (0-100)
            reason: 변경 사유
            
        Returns:
            성공 여부
        """
        try:
            result = self.client.rpc(
                'update_corruption_level',
                {
                    'p_persona_id': persona_id,
                    'p_new_level': new_level,
                    'p_reason': reason
                }
            ).execute()
            
            return result.data is True
            
        except Exception as e:
            logger.error(f"타락도 업데이트 RPC 실패: {e}")
            return False
    
    async def get_persona_stats(self) -> dict:
        """
        페르소나 통계 조회 (대시보드용)
        
        Returns:
            {total_personas, active_count, crisis_count, total_credit, avg_corruption}
        """
        try:
            result = self.client.rpc('get_persona_stats', {}).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            
            return {
                'total_personas': 0,
                'active_count': 0,
                'crisis_count': 0,
                'total_credit': 0,
                'avg_corruption': 0
            }
            
        except Exception as e:
            logger.error(f"페르소나 통계 조회 RPC 실패: {e}")
            raise


# 싱글톤 인스턴스
_rpc_client: Optional[SupabaseRPC] = None


def get_rpc_client() -> SupabaseRPC:
    """Supabase RPC 클라이언트 싱글톤"""
    global _rpc_client
    if _rpc_client is None:
        _rpc_client = SupabaseRPC()
    return _rpc_client

