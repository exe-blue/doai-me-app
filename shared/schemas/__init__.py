"""
Shared Schemas

Pydantic 모델 정의
"""

from .device import (
    DeviceStatus, 
    DeviceBase, 
    DeviceCreate, 
    DeviceUpdate, 
    DeviceInDB,
    DeviceResponse,
    DeviceListResponse,
    DeviceHeartbeat,
)

from .task import (
    TaskStatus, 
    SearchType,
    TaskBase, 
    TaskCreate, 
    TaskInDB,
    TaskResponse,
    TaskResultMessage,
)

from .persona import (
    ExistenceState,
    PersonaTraits,
    PersonaBase, 
    PersonaCreate, 
    PersonaInDB,
    PersonaExistence,
    PersonaResponse,
    ActivityType,
    ATTENTION_REWARDS,
)

from .video import (
    VideoStatus,
    VideoBase, 
    VideoCreate, 
    VideoInDB,
    VideoResponse,
)

from .result import (
    ResultBase,
    ResultCreate,
    ResultInDB,
    AggregatedStats,
)

from .pattern import (
    HumanPatternConfig,
    WatchPatternConfig,
    TouchPatternConfig,
    ScrollPatternConfig,
    InteractionPatternConfig,
    TypingPatternConfig,
)

__all__ = [
    # Device
    "DeviceStatus", "DeviceBase", "DeviceCreate", "DeviceUpdate", 
    "DeviceInDB", "DeviceResponse", "DeviceListResponse", "DeviceHeartbeat",
    # Task
    "TaskStatus", "SearchType", "TaskBase", "TaskCreate", 
    "TaskInDB", "TaskResponse", "TaskResultMessage",
    # Persona
    "ExistenceState", "PersonaTraits", "PersonaBase", "PersonaCreate",
    "PersonaInDB", "PersonaExistence", "PersonaResponse",
    "ActivityType", "ATTENTION_REWARDS",
    # Video
    "VideoStatus", "VideoBase", "VideoCreate", "VideoInDB", "VideoResponse",
    # Result
    "ResultBase", "ResultCreate", "ResultInDB", "AggregatedStats",
    # Pattern
    "HumanPatternConfig", "WatchPatternConfig", "TouchPatternConfig",
    "ScrollPatternConfig", "InteractionPatternConfig", "TypingPatternConfig",
]
