"""
기기 관련 스키마 정의
"""
from datetime import datetime
from typing import Optional
from enum import Enum
from pydantic import BaseModel, Field
import uuid


class DeviceStatus(str, Enum):
    """기기 상태"""
    IDLE = "idle"           # 대기 중
    BUSY = "busy"           # 작업 중
    OFFLINE = "offline"     # 오프라인
    ERROR = "error"         # 오류
    OVERHEAT = "overheat"   # 과열


class DeviceBase(BaseModel):
    """기기 기본 스키마"""
    serial_number: str = Field(..., max_length=100, description="ADB 시리얼 번호")
    pc_id: str = Field(..., max_length=50, description="연결된 PC ID")
    model: Optional[str] = Field(None, max_length=100, description="기기 모델명")


class DeviceCreate(DeviceBase):
    """기기 등록 요청"""
    pass


class DeviceUpdate(BaseModel):
    """기기 업데이트 요청"""
    status: Optional[DeviceStatus] = None
    model: Optional[str] = None
    battery_temp: Optional[float] = None
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    battery_level: Optional[int] = None


class DeviceHealthUpdate(BaseModel):
    """기기 헬스 업데이트"""
    battery_temp: Optional[float] = Field(None, ge=0, le=100, description="배터리 온도 (°C)")
    cpu_usage: Optional[float] = Field(None, ge=0, le=100, description="CPU 사용률 (%)")
    memory_usage: Optional[float] = Field(None, ge=0, le=100, description="메모리 사용률 (%)")
    battery_level: Optional[int] = Field(None, ge=0, le=100, description="배터리 잔량 (%)")


class DeviceInDB(DeviceBase):
    """DB 저장 기기 스키마"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: DeviceStatus = DeviceStatus.OFFLINE
    last_heartbeat: Optional[datetime] = None
    battery_temp: Optional[float] = None
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    battery_level: Optional[int] = None
    total_tasks: int = 0
    success_tasks: int = 0
    error_tasks: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class DeviceResponse(DeviceInDB):
    """기기 응답 스키마"""
    success_rate: float = Field(default=0.0, description="성공률 (%)")
    
    def __init__(self, **data):
        super().__init__(**data)
        if self.total_tasks > 0:
            self.success_rate = (self.success_tasks / self.total_tasks) * 100


class DeviceListResponse(BaseModel):
    """기기 목록 응답"""
    total: int
    idle: int
    busy: int
    offline: int
    error: int
    devices: list[DeviceResponse]


class DeviceHeartbeat(BaseModel):
    """기기 하트비트 메시지"""
    device_id: str
    serial_number: str
    pc_id: str
    status: DeviceStatus
    health: DeviceHealthUpdate
    timestamp: datetime = Field(default_factory=datetime.utcnow)

