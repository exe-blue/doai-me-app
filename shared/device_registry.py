"""
DeviceRegistry - 폰보드-슬롯 기반 디바이스 관리

워크스테이션-폰보드-슬롯 계층 구조로 300대 디바이스를 관리합니다.

명명 규칙:
- 워크스테이션: WS01 ~ WS05
- 폰보드: WS01-PB01 ~ WS01-PB03
- 디바이스: WS01-PB01-S01 ~ WS01-PB01-S20

구조:
- 5 워크스테이션 × 3 폰보드 × 20 슬롯 = 300대
"""

import asyncio
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
from enum import Enum
from dataclasses import dataclass

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

from shared.supabase_client import get_client


class DeviceStatus(str, Enum):
    """디바이스 상태"""
    IDLE = "idle"
    BUSY = "busy"
    OFFLINE = "offline"
    ERROR = "error"
    OVERHEAT = "overheat"
    MAINTENANCE = "maintenance"


class DeviceGroup(str, Enum):
    """디바이스 그룹 (50% 배치 실행용)"""
    A = "A"
    B = "B"


@dataclass
class DeviceInfo:
    """디바이스 정보"""
    id: str
    serial_number: str
    hierarchy_id: str
    workstation_id: str
    phoneboard_id: str
    slot_number: int
    device_group: str
    status: str
    model: Optional[str] = None
    last_heartbeat: Optional[datetime] = None


@dataclass
class PhoneboardInfo:
    """폰보드 정보"""
    id: str
    workstation_id: str
    board_number: int
    slot_count: int
    connected_count: int
    status: str


@dataclass
class WorkstationInfo:
    """워크스테이션 정보"""
    id: str
    name: str
    ip_address: Optional[str]
    vlan_id: Optional[int]
    laixi_connected: bool
    status: str
    total_devices: int
    online_devices: int


class DeviceRegistry:
    """
    폰보드-슬롯 기반 디바이스 레지스트리
    
    디바이스를 워크스테이션-폰보드-슬롯 계층으로 관리하고,
    워크로드 실행을 위한 디바이스 선택/그룹화를 담당합니다.
    
    Usage:
        registry = DeviceRegistry()
        
        # 디바이스 등록
        await registry.register_device(
            serial="ABC123",
            workstation="WS01",
            board=1,
            slot=5
        )
        
        # 사용 가능한 디바이스 조회
        devices = await registry.get_available_devices(group='A')
        
        # 배치 실행용 디바이스 분할
        batch_a, batch_b = await registry.get_batch_groups()
    """
    
    def __init__(self):
        """DeviceRegistry 초기화"""
        self.client = get_client()
    
    # =========================================
    # 워크스테이션 관리
    # =========================================
    
    async def get_workstations(self, status: Optional[str] = None) -> List[WorkstationInfo]:
        """
        워크스테이션 목록 조회
        
        Args:
            status: 필터링할 상태 (online, offline, error)
        
        Returns:
            워크스테이션 정보 목록
        """
        try:
            query = self.client.table("workstations").select("*")
            
            if status:
                query = query.eq("status", status)
            
            result = query.order("id").execute()
            
            return [
                WorkstationInfo(
                    id=ws["id"],
                    name=ws["name"],
                    ip_address=ws.get("ip_address"),
                    vlan_id=ws.get("vlan_id"),
                    laixi_connected=ws.get("laixi_connected", False),
                    status=ws["status"],
                    total_devices=ws.get("total_devices", 0),
                    online_devices=ws.get("online_devices", 0)
                )
                for ws in (result.data or [])
            ]
        except Exception as e:
            logger.error(f"워크스테이션 목록 조회 실패: {e}")
            return []
    
    async def update_workstation_status(
        self,
        workstation_id: str,
        status: Optional[str] = None,
        laixi_connected: Optional[bool] = None,
        ip_address: Optional[str] = None
    ) -> bool:
        """
        워크스테이션 상태 업데이트
        
        Args:
            workstation_id: 워크스테이션 ID
            status: 새 상태
            laixi_connected: Laixi 연결 상태
            ip_address: IP 주소
        
        Returns:
            성공 여부
        """
        try:
            update_data: Dict[str, Any] = {
                "last_heartbeat": datetime.now(timezone.utc).isoformat()
            }
            
            if status is not None:
                update_data["status"] = status
            if laixi_connected is not None:
                update_data["laixi_connected"] = laixi_connected
            if ip_address is not None:
                update_data["ip_address"] = ip_address
            
            result = self.client.table("workstations").update(
                update_data
            ).eq("id", workstation_id).execute()
            
            return bool(result.data)
        except Exception as e:
            logger.error(f"워크스테이션 상태 업데이트 실패: {workstation_id} - {e}")
            return False
    
    # =========================================
    # 폰보드 관리
    # =========================================
    
    async def get_phoneboards(
        self,
        workstation_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[PhoneboardInfo]:
        """
        폰보드 목록 조회
        
        Args:
            workstation_id: 워크스테이션 ID 필터
            status: 상태 필터
        
        Returns:
            폰보드 정보 목록
        """
        try:
            query = self.client.table("phoneboards").select("*")
            
            if workstation_id:
                query = query.eq("workstation_id", workstation_id)
            if status:
                query = query.eq("status", status)
            
            result = query.order("id").execute()
            
            return [
                PhoneboardInfo(
                    id=pb["id"],
                    workstation_id=pb["workstation_id"],
                    board_number=pb["board_number"],
                    slot_count=pb.get("slot_count", 20),
                    connected_count=pb.get("connected_count", 0),
                    status=pb["status"]
                )
                for pb in (result.data or [])
            ]
        except Exception as e:
            logger.error(f"폰보드 목록 조회 실패: {e}")
            return []
    
    async def update_phoneboard_status(
        self,
        phoneboard_id: str,
        status: str,
        connected_count: Optional[int] = None
    ) -> bool:
        """폰보드 상태 업데이트"""
        try:
            update_data: Dict[str, Any] = {
                "status": status,
                "last_heartbeat": datetime.now(timezone.utc).isoformat()
            }
            
            if connected_count is not None:
                update_data["connected_count"] = connected_count
            
            result = self.client.table("phoneboards").update(
                update_data
            ).eq("id", phoneboard_id).execute()
            
            return bool(result.data)
        except Exception as e:
            logger.error(f"폰보드 상태 업데이트 실패: {phoneboard_id} - {e}")
            return False
    
    # =========================================
    # 디바이스 등록/관리
    # =========================================
    
    async def register_device(
        self,
        serial: str,
        workstation: str,
        board: int,
        slot: int,
        model: Optional[str] = None
    ) -> Optional[DeviceInfo]:
        """
        디바이스 등록 (폰보드-슬롯 기반)
        
        Args:
            serial: ADB 시리얼 번호
            workstation: 워크스테이션 ID (예: WS01)
            board: 폰보드 번호 (1-3)
            slot: 슬롯 번호 (1-20)
            model: 기기 모델명
        
        Returns:
            등록된 디바이스 정보 또는 None
        """
        try:
            phoneboard_id = f"{workstation}-PB{board:02d}"
            hierarchy_id = f"{phoneboard_id}-S{slot:02d}"
            
            # 그룹 할당 (홀수/짝수)
            device_group = "A" if slot % 2 == 1 else "B"
            
            now = datetime.now(timezone.utc).isoformat()
            
            data = {
                "serial_number": serial,
                "pc_id": workstation,  # 레거시 호환
                "workstation_id": workstation,
                "phoneboard_id": phoneboard_id,
                "slot_number": slot,
                "hierarchy_id": hierarchy_id,
                "device_group": device_group,
                "status": "idle",
                "last_heartbeat": now
            }
            
            if model:
                data["model"] = model
            
            result = self.client.table("devices").upsert(
                data,
                on_conflict="serial_number"
            ).execute()
            
            if result.data and len(result.data) > 0:
                device = result.data[0]
                logger.info(f"디바이스 등록: {hierarchy_id} (serial={serial})")
                
                return DeviceInfo(
                    id=device["id"],
                    serial_number=device["serial_number"],
                    hierarchy_id=device.get("hierarchy_id", hierarchy_id),
                    workstation_id=workstation,
                    phoneboard_id=phoneboard_id,
                    slot_number=slot,
                    device_group=device_group,
                    status=device["status"],
                    model=device.get("model"),
                    last_heartbeat=datetime.fromisoformat(now)
                )
            
            return None
        except Exception as e:
            logger.error(f"디바이스 등록 실패: {serial} - {e}")
            return None
    
    async def bulk_register_devices(
        self,
        devices: List[Dict[str, Any]]
    ) -> List[DeviceInfo]:
        """
        여러 디바이스 일괄 등록
        
        Args:
            devices: [{"serial": "xxx", "workstation": "WS01", "board": 1, "slot": 5}, ...]
        
        Returns:
            등록된 디바이스 목록
        """
        results = []
        
        for device in devices:
            result = await self.register_device(
                serial=device["serial"],
                workstation=device["workstation"],
                board=device["board"],
                slot=device["slot"],
                model=device.get("model")
            )
            if result:
                results.append(result)
        
        logger.info(f"{len(results)}대 디바이스 일괄 등록 완료")
        return results
    
    # =========================================
    # 디바이스 조회
    # =========================================
    
    async def get_device_by_serial(self, serial: str) -> Optional[DeviceInfo]:
        """시리얼 번호로 디바이스 조회"""
        try:
            result = self.client.table("devices").select("*").eq(
                "serial_number", serial
            ).single().execute()
            
            if result.data:
                return self._to_device_info(result.data)
            return None
        except Exception:
            return None
    
    async def get_device_by_hierarchy(self, hierarchy_id: str) -> Optional[DeviceInfo]:
        """계층 ID로 디바이스 조회 (예: WS01-PB01-S05)"""
        try:
            result = self.client.table("devices").select("*").eq(
                "hierarchy_id", hierarchy_id
            ).single().execute()
            
            if result.data:
                return self._to_device_info(result.data)
            return None
        except Exception:
            return None
    
    async def get_devices(
        self,
        workstation_id: Optional[str] = None,
        phoneboard_id: Optional[str] = None,
        status: Optional[str] = None,
        group: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[DeviceInfo]:
        """
        디바이스 목록 조회 (필터 지원)
        
        Args:
            workstation_id: 워크스테이션 필터
            phoneboard_id: 폰보드 필터
            status: 상태 필터 (idle, busy, offline, error)
            group: 그룹 필터 (A, B)
            limit: 최대 개수
        
        Returns:
            디바이스 목록
        """
        try:
            query = self.client.table("devices").select("*")
            
            if workstation_id:
                query = query.eq("workstation_id", workstation_id)
            if phoneboard_id:
                query = query.eq("phoneboard_id", phoneboard_id)
            if status:
                query = query.eq("status", status)
            if group:
                query = query.eq("device_group", group)
            
            query = query.order("hierarchy_id")
            
            if limit:
                query = query.limit(limit)
            
            result = query.execute()
            
            return [self._to_device_info(d) for d in (result.data or [])]
        except Exception as e:
            logger.error(f"디바이스 목록 조회 실패: {e}")
            return []
    
    async def get_available_devices(
        self,
        workstation_id: Optional[str] = None,
        group: Optional[str] = None,
        count: Optional[int] = None
    ) -> List[DeviceInfo]:
        """
        사용 가능한 (idle 상태) 디바이스 조회
        
        Args:
            workstation_id: 특정 워크스테이션만
            group: 특정 그룹만 (A 또는 B)
            count: 필요한 개수
        
        Returns:
            사용 가능한 디바이스 목록
        """
        return await self.get_devices(
            workstation_id=workstation_id,
            status="idle",
            group=group,
            limit=count
        )
    
    async def get_batch_groups(
        self,
        workstation_id: Optional[str] = None
    ) -> Tuple[List[DeviceInfo], List[DeviceInfo]]:
        """
        배치 실행용 디바이스 그룹 분할
        
        50% 배치 실행을 위해 A/B 그룹으로 분할된 디바이스 반환
        
        Args:
            workstation_id: 특정 워크스테이션만
        
        Returns:
            (그룹 A 디바이스, 그룹 B 디바이스) 튜플
        """
        group_a = await self.get_available_devices(
            workstation_id=workstation_id,
            group="A"
        )
        group_b = await self.get_available_devices(
            workstation_id=workstation_id,
            group="B"
        )
        
        logger.info(f"배치 그룹: A={len(group_a)}대, B={len(group_b)}대")
        return (group_a, group_b)
    
    # =========================================
    # 디바이스 상태 관리
    # =========================================
    
    async def set_device_status(
        self,
        device_id: str,
        status: str,
        error_message: Optional[str] = None
    ) -> bool:
        """
        디바이스 상태 변경
        
        Args:
            device_id: 디바이스 ID (UUID 또는 serial 또는 hierarchy_id)
            status: 새 상태
            error_message: 오류 메시지 (status=error인 경우)
        
        Returns:
            성공 여부
        """
        try:
            update_data: Dict[str, Any] = {
                "status": status,
                "last_heartbeat": datetime.now(timezone.utc).isoformat()
            }
            
            # ID 타입 판별
            if "-PB" in device_id and "-S" in device_id:
                # hierarchy_id
                query = self.client.table("devices").update(update_data).eq("hierarchy_id", device_id)
            elif len(device_id) == 36 and "-" in device_id:
                # UUID
                query = self.client.table("devices").update(update_data).eq("id", device_id)
            else:
                # serial_number
                query = self.client.table("devices").update(update_data).eq("serial_number", device_id)
            
            result = query.execute()
            return bool(result.data)
        except Exception as e:
            logger.error(f"디바이스 상태 변경 실패: {device_id} - {e}")
            return False
    
    async def set_devices_busy(self, device_ids: List[str]) -> int:
        """여러 디바이스를 busy 상태로 변경"""
        count = 0
        for device_id in device_ids:
            if await self.set_device_status(device_id, "busy"):
                count += 1
        return count
    
    async def set_devices_idle(self, device_ids: List[str]) -> int:
        """여러 디바이스를 idle 상태로 변경"""
        count = 0
        for device_id in device_ids:
            if await self.set_device_status(device_id, "idle"):
                count += 1
        return count
    
    async def mark_offline_stale_devices(
        self,
        stale_threshold_seconds: int = 300
    ) -> int:
        """
        일정 시간 동안 하트비트 없는 디바이스를 offline으로 변경
        
        Args:
            stale_threshold_seconds: 하트비트 기준 시간 (기본 5분)
        
        Returns:
            변경된 디바이스 수
        """
        try:
            threshold = datetime.now(timezone.utc) - timedelta(seconds=stale_threshold_seconds)
            
            result = self.client.table("devices").update({
                "status": "offline"
            }).lt("last_heartbeat", threshold.isoformat()).neq(
                "status", "offline"
            ).execute()
            
            count = len(result.data) if result.data else 0
            if count > 0:
                logger.warning(f"{count}대 디바이스 offline 처리 (stale)")
            return count
        except Exception as e:
            logger.error(f"stale 디바이스 처리 실패: {e}")
            return 0
    
    async def update_device_command(
        self,
        device_id: str,
        command: str,
        result: Optional[str] = None
    ) -> bool:
        """
        디바이스 마지막 명령 정보 업데이트
        
        Args:
            device_id: 디바이스 ID
            command: 명령 이름
            result: 명령 결과 (success, failed, timeout)
        """
        try:
            update_data: Dict[str, Any] = {
                "last_command": command,
                "last_command_at": datetime.now(timezone.utc).isoformat()
            }
            
            if result:
                update_data["last_command_result"] = result
            
            self.client.table("devices").update(update_data).eq(
                "serial_number" if not "-" in device_id else "hierarchy_id",
                device_id
            ).execute()
            
            return True
        except Exception as e:
            logger.error(f"명령 정보 업데이트 실패: {device_id} - {e}")
            return False
    
    # =========================================
    # 통계
    # =========================================
    
    async def get_device_stats(
        self,
        workstation_id: Optional[str] = None
    ) -> Dict[str, int]:
        """
        디바이스 상태별 통계
        
        Returns:
            {"total": 300, "idle": 250, "busy": 30, "offline": 15, "error": 5}
        """
        try:
            query = self.client.table("devices").select("status")
            
            if workstation_id:
                query = query.eq("workstation_id", workstation_id)
            
            result = query.execute()
            devices = result.data or []
            
            stats = {
                "total": len(devices),
                "idle": 0,
                "busy": 0,
                "offline": 0,
                "error": 0
            }
            
            for device in devices:
                status = device.get("status", "offline")
                if status in stats:
                    stats[status] += 1
            
            return stats
        except Exception as e:
            logger.error(f"디바이스 통계 조회 실패: {e}")
            return {"total": 0, "idle": 0, "busy": 0, "offline": 0, "error": 0}
    
    # =========================================
    # 유틸리티
    # =========================================
    
    def _to_device_info(self, data: Dict[str, Any]) -> DeviceInfo:
        """DB 레코드를 DeviceInfo로 변환"""
        return DeviceInfo(
            id=data["id"],
            serial_number=data["serial_number"],
            hierarchy_id=data.get("hierarchy_id", ""),
            workstation_id=data.get("workstation_id", ""),
            phoneboard_id=data.get("phoneboard_id", ""),
            slot_number=data.get("slot_number", 0),
            device_group=data.get("device_group", "A"),
            status=data["status"],
            model=data.get("model"),
            last_heartbeat=datetime.fromisoformat(data["last_heartbeat"]) if data.get("last_heartbeat") else None
        )
    
    @staticmethod
    def parse_hierarchy_id(hierarchy_id: str) -> Optional[Dict[str, Any]]:
        """
        계층 ID 파싱
        
        Args:
            hierarchy_id: "WS01-PB02-S15" 형식
        
        Returns:
            {"workstation": "WS01", "board": 2, "slot": 15}
        """
        try:
            parts = hierarchy_id.split("-")
            if len(parts) != 3:
                return None
            
            workstation = parts[0]
            board = int(parts[1][2:])  # "PB02" -> 2
            slot = int(parts[2][1:])   # "S15" -> 15
            
            return {
                "workstation": workstation,
                "board": board,
                "slot": slot,
                "phoneboard_id": f"{workstation}-{parts[1]}"
            }
        except Exception:
            return None


# 싱글톤 인스턴스
_registry: Optional[DeviceRegistry] = None


def get_device_registry() -> DeviceRegistry:
    """DeviceRegistry 싱글톤 반환"""
    global _registry
    if _registry is None:
        _registry = DeviceRegistry()
    return _registry
