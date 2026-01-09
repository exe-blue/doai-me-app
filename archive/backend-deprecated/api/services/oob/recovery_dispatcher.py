"""
DoAi.Me OOB - Recovery Dispatcher
Tailscale SSH를 통한 원격 복구 실행

Strategos Security Design v1
"""

import asyncio
import logging
import subprocess
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional, List

from .rule_engine import RecoveryAction

logger = logging.getLogger(__name__)


class RecoveryStatus(str, Enum):
    """복구 실행 상태"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"  # 쿨다운 등으로 스킵


@dataclass
class RecoveryResult:
    """복구 실행 결과"""
    node_id: str
    action: RecoveryAction
    status: RecoveryStatus
    exit_code: Optional[int] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    error_message: Optional[str] = None
    started_at: datetime = None
    completed_at: datetime = None
    duration_sec: float = 0.0
    
    def __post_init__(self):
        if self.started_at and self.completed_at:
            self.duration_sec = (self.completed_at - self.started_at).total_seconds()


class RecoveryDispatcher:
    """
    원격 복구 실행기
    
    역할:
    - Tailscale SSH를 통해 노드에 접속
    - recover.sh 스크립트 실행
    - 실행 결과 수집 및 보고
    """
    
    def __init__(
        self,
        ssh_user: str = "doaiops",
        ssh_timeout_sec: int = 30,
        script_path: str = "/opt/doai/bin/recover.sh"
    ):
        self.ssh_user = ssh_user
        self.ssh_timeout_sec = ssh_timeout_sec
        self.script_path = script_path
        
        # 실행 히스토리
        self._history: List[RecoveryResult] = []
        self._max_history = 100
    
    async def execute_recovery(
        self,
        node_id: str,
        tailscale_ip: str,
        action: RecoveryAction,
        dry_run: bool = False
    ) -> RecoveryResult:
        """
        복구 스크립트 실행
        
        Args:
            node_id: 노드 ID
            tailscale_ip: Tailscale IP (100.x.x.x)
            action: 복구 액션 타입
            dry_run: True면 실제 실행 없이 명령만 로깅
        
        Returns:
            RecoveryResult: 실행 결과
        """
        started_at = datetime.utcnow()
        
        # 복구 모드 매핑
        mode_map = {
            RecoveryAction.SOFT: "soft",
            RecoveryAction.RESTART: "restart",
            RecoveryAction.BOX_RESET: "box_reset"
        }
        mode = mode_map.get(action, "soft")
        
        # SSH 명령 구성
        ssh_cmd = [
            "ssh",
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", f"ConnectTimeout={self.ssh_timeout_sec}",
            f"{self.ssh_user}@{tailscale_ip}",
            f"sudo {self.script_path} {mode}"
        ]
        
        logger.info(f"Executing recovery: {node_id} ({tailscale_ip}) -> {action.value}")
        logger.debug(f"SSH command: {' '.join(ssh_cmd)}")
        
        if dry_run:
            logger.info(f"[DRY RUN] Would execute: {' '.join(ssh_cmd)}")
            return RecoveryResult(
                node_id=node_id,
                action=action,
                status=RecoveryStatus.SKIPPED,
                error_message="Dry run mode",
                started_at=started_at,
                completed_at=datetime.utcnow()
            )
        
        try:
            # 비동기 subprocess 실행
            process = await asyncio.create_subprocess_exec(
                *ssh_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=self.ssh_timeout_sec + 30  # 스크립트 실행 시간 여유
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                
                completed_at = datetime.utcnow()
                result = RecoveryResult(
                    node_id=node_id,
                    action=action,
                    status=RecoveryStatus.FAILED,
                    error_message="SSH command timed out",
                    started_at=started_at,
                    completed_at=completed_at
                )
                self._record_result(result)
                return result
            
            completed_at = datetime.utcnow()
            
            # 결과 처리
            exit_code = process.returncode
            stdout_str = stdout.decode('utf-8', errors='replace').strip()
            stderr_str = stderr.decode('utf-8', errors='replace').strip()
            
            status = RecoveryStatus.SUCCESS if exit_code == 0 else RecoveryStatus.FAILED
            
            result = RecoveryResult(
                node_id=node_id,
                action=action,
                status=status,
                exit_code=exit_code,
                stdout=stdout_str,
                stderr=stderr_str,
                started_at=started_at,
                completed_at=completed_at
            )
            
            if status == RecoveryStatus.SUCCESS:
                logger.info(f"Recovery successful: {node_id} ({action.value})")
            else:
                logger.error(f"Recovery failed: {node_id} ({action.value}) - exit={exit_code}, stderr={stderr_str}")
            
            self._record_result(result)
            return result
            
        except Exception as e:
            completed_at = datetime.utcnow()
            logger.exception(f"Recovery execution error: {node_id}")
            
            result = RecoveryResult(
                node_id=node_id,
                action=action,
                status=RecoveryStatus.FAILED,
                error_message=str(e),
                started_at=started_at,
                completed_at=completed_at
            )
            self._record_result(result)
            return result
    
    async def execute_box_reset(
        self,
        node_id: str,
        box_ip: str,
        box_port: int,
        slot_number: Optional[int] = None
    ) -> RecoveryResult:
        """
        박스 전원 제어 (BoxClient 연계)
        
        이 메서드는 BoxClient를 통해 실행됨
        """
        from .box_client import BoxClient, BoxCommand
        
        started_at = datetime.utcnow()
        
        try:
            client = BoxClient(box_ip, box_port)
            
            if slot_number:
                # 특정 슬롯만 리셋
                success = await client.slot_power_cycle(slot_number)
            else:
                # 전체 리셋
                success = await client.power_cycle_all()
            
            completed_at = datetime.utcnow()
            
            result = RecoveryResult(
                node_id=node_id,
                action=RecoveryAction.BOX_RESET,
                status=RecoveryStatus.SUCCESS if success else RecoveryStatus.FAILED,
                started_at=started_at,
                completed_at=completed_at
            )
            
            if success:
                logger.info(f"Box reset successful: {node_id} (slot={slot_number or 'all'})")
            else:
                logger.error(f"Box reset failed: {node_id}")
            
            self._record_result(result)
            return result
            
        except Exception as e:
            completed_at = datetime.utcnow()
            logger.exception(f"Box reset error: {node_id}")
            
            result = RecoveryResult(
                node_id=node_id,
                action=RecoveryAction.BOX_RESET,
                status=RecoveryStatus.FAILED,
                error_message=str(e),
                started_at=started_at,
                completed_at=completed_at
            )
            self._record_result(result)
            return result
    
    def _record_result(self, result: RecoveryResult):
        """결과 히스토리 기록"""
        self._history.append(result)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]
    
    def get_history(
        self, 
        node_id: Optional[str] = None,
        limit: int = 20
    ) -> List[RecoveryResult]:
        """복구 히스토리 조회"""
        results = self._history
        if node_id:
            results = [r for r in results if r.node_id == node_id]
        return results[-limit:]
    
    async def test_ssh_connection(self, tailscale_ip: str) -> bool:
        """SSH 연결 테스트"""
        try:
            cmd = [
                "ssh",
                "-o", "StrictHostKeyChecking=no",
                "-o", "UserKnownHostsFile=/dev/null",
                "-o", "ConnectTimeout=5",
                f"{self.ssh_user}@{tailscale_ip}",
                "echo ok"
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, _ = await asyncio.wait_for(
                process.communicate(),
                timeout=10
            )
            
            return process.returncode == 0 and b"ok" in stdout
            
        except Exception as e:
            logger.warning(f"SSH test failed for {tailscale_ip}: {e}")
            return False

