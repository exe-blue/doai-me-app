"""
DoAi.Me OOB - Box Control Client
TCP를 통한 박스 전원 제어

Strategos Security Design v1

박스 프로토콜:
- Transport: TCP client -> server
- Destination: <BOX_IP>:56666
- Payload: Binary bytes (HEX 바이트열)
- 예: "AA 01 88 84 01 00 DD" -> bytes: 0xAA 0x01 0x88 0x84 0x01 0x00 0xDD
"""

import asyncio
import logging
import socket
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Tuple, List

logger = logging.getLogger(__name__)


class BoxCommand(str, Enum):
    """박스 제어 명령 타입"""
    # 전체 제어
    ALL_POWER_ON = "all_power_on"
    ALL_POWER_OFF = "all_power_off"
    ALL_OTG_MODE = "all_otg_mode"
    ALL_USB_MODE = "all_usb_mode"
    
    # 슬롯 제어
    SLOT_POWER_ON = "slot_power_on"
    SLOT_POWER_OFF = "slot_power_off"
    SLOT_OTG_MODE = "slot_otg_mode"
    SLOT_USB_MODE = "slot_usb_mode"


@dataclass
class BoxConfig:
    """
    박스 명령 설정
    
    boxconfig.ini에서 파싱된 HEX 명령어들
    """
    # 전체 제어 명령 (HEX 바이트열)
    all_power_on: str = "AA 01 88 84 01 00 DD"
    all_power_off: str = "AA 01 88 84 00 00 DD"
    all_otg_mode: str = "AA 01 88 82 01 00 DD"
    all_usb_mode: str = "AA 01 88 82 00 00 DD"
    
    # 슬롯별 제어 명령 패턴 (슬롯 번호가 바이트에 들어감)
    # 형식: AA 01 88 {cmd_type} {slot} 00 DD
    # cmd_type: 84=전원, 82=모드
    # 실제 값은 박스 문서 확인 필요
    
    @classmethod
    def from_ini_file(cls, ini_path: str) -> 'BoxConfig':
        """boxconfig.ini에서 설정 로드"""
        import configparser
        config = configparser.ConfigParser()
        config.read(ini_path)
        
        return cls(
            all_power_on=config.get('Commands', 'OnAll', fallback=cls.all_power_on),
            all_power_off=config.get('Commands', 'OffAll', fallback=cls.all_power_off),
            all_otg_mode=config.get('Commands', 'OTGAll', fallback=cls.all_otg_mode),
            all_usb_mode=config.get('Commands', 'USBAll', fallback=cls.all_usb_mode),
        )


@dataclass
class BoxResponse:
    """박스 응답 (있을 경우)"""
    success: bool
    raw_data: Optional[bytes] = None
    error: Optional[str] = None


class BoxClient:
    """
    박스 TCP 제어 클라이언트
    
    사용법:
        client = BoxClient("192.168.50.1", 56666)
        success = await client.power_off_all()
        await asyncio.sleep(5)
        success = await client.power_on_all()
    """
    
    def __init__(
        self,
        host: str,
        port: int = 56666,
        config: Optional[BoxConfig] = None,
        timeout_sec: float = 5.0
    ):
        self.host = host
        self.port = port
        self.config = config or BoxConfig()
        self.timeout_sec = timeout_sec
    
    @staticmethod
    def hex_to_bytes(hex_str: str) -> bytes:
        """
        HEX 문자열을 바이트로 변환
        예: "AA 01 88 84 01 00 DD" -> b'\\xaa\\x01\\x88\\x84\\x01\\x00\\xdd'
        """
        hex_clean = hex_str.replace(" ", "").replace("-", "")
        return bytes.fromhex(hex_clean)
    
    async def _send_command(
        self, 
        hex_command: str,
        expect_response: bool = False
    ) -> BoxResponse:
        """
        박스에 TCP 명령 전송
        
        Args:
            hex_command: HEX 형식 명령어 (예: "AA 01 88 84 01 00 DD")
            expect_response: 응답을 기다릴지 여부
        
        Returns:
            BoxResponse: 실행 결과
        """
        try:
            cmd_bytes = self.hex_to_bytes(hex_command)
            logger.debug(f"Sending to box {self.host}:{self.port}: {hex_command}")
            
            # TCP 연결 및 전송
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port),
                timeout=self.timeout_sec
            )
            
            try:
                writer.write(cmd_bytes)
                await writer.drain()
                
                # 응답 대기 (선택적)
                raw_response = None
                if expect_response:
                    try:
                        raw_response = await asyncio.wait_for(
                            reader.read(1024),
                            timeout=1.0  # 응답 타임아웃 짧게
                        )
                        logger.debug(f"Box response: {raw_response.hex() if raw_response else 'empty'}")
                    except asyncio.TimeoutError:
                        # 응답 없음 - 일부 박스는 응답 안 함
                        logger.debug("No response from box (timeout)")
                
                return BoxResponse(success=True, raw_data=raw_response)
                
            finally:
                writer.close()
                await writer.wait_closed()
                
        except asyncio.TimeoutError:
            error = f"Connection timeout to box {self.host}:{self.port}"
            logger.error(error)
            return BoxResponse(success=False, error=error)
            
        except ConnectionRefusedError:
            error = f"Connection refused by box {self.host}:{self.port}"
            logger.error(error)
            return BoxResponse(success=False, error=error)
            
        except Exception as e:
            error = f"Box command error: {e}"
            logger.exception(error)
            return BoxResponse(success=False, error=error)
    
    # === 전체 제어 메서드 ===
    
    async def power_on_all(self) -> bool:
        """모든 슬롯 전원 ON"""
        result = await self._send_command(self.config.all_power_on)
        if result.success:
            logger.info(f"Box {self.host}: All power ON")
        return result.success
    
    async def power_off_all(self) -> bool:
        """모든 슬롯 전원 OFF"""
        result = await self._send_command(self.config.all_power_off)
        if result.success:
            logger.info(f"Box {self.host}: All power OFF")
        return result.success
    
    async def set_otg_mode_all(self) -> bool:
        """모든 슬롯 OTG 모드"""
        result = await self._send_command(self.config.all_otg_mode)
        if result.success:
            logger.info(f"Box {self.host}: All OTG mode")
        return result.success
    
    async def set_usb_mode_all(self) -> bool:
        """모든 슬롯 USB 모드"""
        result = await self._send_command(self.config.all_usb_mode)
        if result.success:
            logger.info(f"Box {self.host}: All USB mode")
        return result.success
    
    async def power_cycle_all(self, delay_sec: float = 5.0) -> bool:
        """전체 전원 순환 (OFF -> 대기 -> ON)"""
        logger.info(f"Starting power cycle for box {self.host}")
        
        off_result = await self.power_off_all()
        if not off_result:
            return False
        
        await asyncio.sleep(delay_sec)
        
        on_result = await self.power_on_all()
        return on_result
    
    # === 슬롯별 제어 메서드 ===
    
    async def slot_power_on(self, slot: int) -> bool:
        """특정 슬롯 전원 ON"""
        # 슬롯별 명령 생성 (박스 프로토콜에 따라 조정 필요)
        # 형식 예: AA 01 88 84 {slot} 01 DD
        hex_cmd = f"AA 01 88 84 {slot:02X} 01 DD"
        result = await self._send_command(hex_cmd)
        if result.success:
            logger.info(f"Box {self.host}: Slot {slot} power ON")
        return result.success
    
    async def slot_power_off(self, slot: int) -> bool:
        """특정 슬롯 전원 OFF"""
        hex_cmd = f"AA 01 88 84 {slot:02X} 00 DD"
        result = await self._send_command(hex_cmd)
        if result.success:
            logger.info(f"Box {self.host}: Slot {slot} power OFF")
        return result.success
    
    async def slot_power_cycle(self, slot: int, delay_sec: float = 3.0) -> bool:
        """특정 슬롯 전원 순환"""
        logger.info(f"Starting power cycle for slot {slot} on box {self.host}")
        
        off_result = await self.slot_power_off(slot)
        if not off_result:
            return False
        
        await asyncio.sleep(delay_sec)
        
        on_result = await self.slot_power_on(slot)
        return on_result
    
    # === 연결 테스트 ===
    
    async def test_connection(self) -> bool:
        """박스 TCP 연결 테스트"""
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port),
                timeout=self.timeout_sec
            )
            writer.close()
            await writer.wait_closed()
            logger.info(f"Box {self.host}:{self.port} connection OK")
            return True
        except Exception as e:
            logger.warning(f"Box {self.host}:{self.port} connection failed: {e}")
            return False
    
    @classmethod
    async def discover_protocol(
        cls,
        host: str,
        port: int = 56666,
        test_command: str = "AA 01 88 84 01 00 DD"
    ) -> dict:
        """
        박스 프로토콜 탐색 (30분 안에 확정하기 위한 테스트)
        
        Returns:
            dict: 탐색 결과
            {
                "connection_ok": bool,
                "command_sent": bool,
                "has_response": bool,
                "response_hex": str or None,
                "response_length": int,
                "notes": str
            }
        """
        result = {
            "connection_ok": False,
            "command_sent": False,
            "has_response": False,
            "response_hex": None,
            "response_length": 0,
            "notes": ""
        }
        
        try:
            # 연결 테스트
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port),
                timeout=5.0
            )
            result["connection_ok"] = True
            
            # 명령 전송
            cmd_bytes = cls.hex_to_bytes(test_command)
            writer.write(cmd_bytes)
            await writer.drain()
            result["command_sent"] = True
            
            # 응답 대기
            try:
                response = await asyncio.wait_for(
                    reader.read(1024),
                    timeout=2.0
                )
                if response:
                    result["has_response"] = True
                    result["response_hex"] = response.hex()
                    result["response_length"] = len(response)
                    result["notes"] = "박스가 응답을 반환함 - ACK 프로토콜 있음"
                else:
                    result["notes"] = "박스가 빈 응답 반환 - 연결 종료형일 수 있음"
            except asyncio.TimeoutError:
                result["notes"] = "응답 없음 - Fire-and-forget 방식으로 추정"
            
            writer.close()
            await writer.wait_closed()
            
        except asyncio.TimeoutError:
            result["notes"] = "연결 타임아웃 - 박스 IP/포트 확인 필요"
        except ConnectionRefusedError:
            result["notes"] = "연결 거부됨 - 박스가 포트를 열지 않음"
        except Exception as e:
            result["notes"] = f"오류: {str(e)}"
        
        return result

