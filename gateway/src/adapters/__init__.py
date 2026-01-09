"""
Adapters 모듈 - Device Driver 추상화 계층

Strangler Pattern:
- DeviceDriver: 추상 인터페이스
- LaixiDriver: 현재 구현 (임시)
- ScrcpyDriver: 향후 구현 (영구)
"""

from .device_driver import (
    DeviceDriver,
    DriverType,
    DeviceInfo,
    TapResult,
    SwipeResult,
    TextResult,
    get_driver,
    set_driver,
)

from .laixi_driver import LaixiDriver

from .behavior_engine import (
    BehaviorEngine,
    WatchConfig,
    TouchConfig,
    ScrollConfig,
    InteractionConfig,
    WatchPattern,
    InteractionPattern,
    HumanPattern,
)

from .youtube_watcher import YouTubeWatcher, WatchSession

__all__ = [
    # Device Driver
    "DeviceDriver",
    "DriverType",
    "DeviceInfo",
    "TapResult",
    "SwipeResult",
    "TextResult",
    "get_driver",
    "set_driver",
    
    # Laixi Driver
    "LaixiDriver",
    
    # Behavior Engine
    "BehaviorEngine",
    "WatchConfig",
    "TouchConfig",
    "ScrollConfig",
    "InteractionConfig",
    "WatchPattern",
    "InteractionPattern",
    "HumanPattern",
    
    # YouTube Watcher
    "YouTubeWatcher",
    "WatchSession",
]

