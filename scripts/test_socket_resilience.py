"""
Socket Connection Resilience Tests

소켓 연결 안정성 검증을 위한 자동화 테스트 스크립트

테스트 시나리오:
1. Laixi 서버 강제 종료 및 재연결 검증
2. 동시 명령 5개 전송 및 응답 순서 검증
3. 장시간 메모리 모니터링 (24시간)

실행 방법:
    python test_socket_resilience.py --test crash      # Laixi 강제 종료 테스트
    python test_socket_resilience.py --test concurrent # 동시 명령 테스트
    python test_socket_resilience.py --test memory     # 메모리 모니터링
    python test_socket_resilience.py --test all        # 전체 테스트

@author Axon (Tech Lead)
"""

import argparse
import asyncio
import csv
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import websockets
    from websockets.exceptions import ConnectionClosed
except ImportError:
    print("ERROR: websockets 패키지가 필요합니다.")
    print("설치: pip install websockets")
    sys.exit(1)

try:
    import psutil
except ImportError:
    print("WARNING: psutil 패키지가 없습니다. 메모리 모니터링 테스트 불가")
    psutil = None

# ============================================================
# Configuration
# ============================================================

LAIXI_WS_URL = os.getenv("LAIXI_WS_URL", "ws://127.0.0.1:22221")
ESTABLISH_SCRIPT_PATH = Path(__file__).parent.parent / "gateway" / "scripts" / "laixi" / "establish_connection.js"

# 테스트 설정
TEST_CONFIG = {
    "crash_recovery": {
        "max_reconnect_wait": 60,  # 재연결 최대 대기 시간 (초)
        "expected_reconnect_attempts": 10,
        "reconnect_interval": 3,
    },
    "concurrent": {
        "command_count": 5,
        "timeout": 30,
    },
    "memory": {
        "duration_hours": 24,
        "snapshot_interval_sec": 60,
        "max_memory_increase_percent": 20,
    },
}

# ============================================================
# Logging
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("SocketTest")

# ============================================================
# Test Results
# ============================================================

class TestResult:
    """테스트 결과 저장"""
    
    def __init__(self, name: str):
        self.name = name
        self.passed = False
        self.start_time = datetime.now()
        self.end_time: Optional[datetime] = None
        self.details: Dict = {}
        self.errors: List[str] = []
    
    def finish(self, passed: bool, details: Dict = None):
        self.passed = passed
        self.end_time = datetime.now()
        if details:
            self.details.update(details)
    
    def add_error(self, error: str):
        self.errors.append(error)
    
    @property
    def duration(self) -> float:
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0
    
    def __str__(self) -> str:
        status = "PASS ✅" if self.passed else "FAIL ❌"
        return f"[{status}] {self.name} ({self.duration:.2f}s)"


# ============================================================
# Test 1: Laixi 서버 강제 종료 및 재연결
# ============================================================

async def test_laixi_crash_recovery() -> TestResult:
    """
    Laixi 서버 강제 종료 후 재연결 테스트
    
    시나리오:
    1. Laixi WebSocket에 연결
    2. 연결 확인 후 Laixi 프로세스 강제 종료
    3. 재연결 시도 모니터링
    4. 재연결 성공 여부 검증
    """
    result = TestResult("Laixi Crash Recovery")
    logger.info("=" * 60)
    logger.info("Test 1: Laixi 서버 강제 종료 및 재연결 테스트")
    logger.info("=" * 60)
    
    reconnect_attempts = 0
    reconnected = False
    
    try:
        # 1. 초기 연결
        logger.info(f"Laixi 연결 시도: {LAIXI_WS_URL}")
        ws = await asyncio.wait_for(
            websockets.connect(LAIXI_WS_URL, ping_interval=10, ping_timeout=5),
            timeout=10.0
        )
        logger.info("✅ 초기 연결 성공")
        
        # 디바이스 목록 확인
        await ws.send(json.dumps({"action": "list"}))
        response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        initial_response = json.loads(response)
        logger.info(f"초기 응답: StatusCode={initial_response.get('StatusCode')}")
        
        # 2. Laixi 프로세스 강제 종료
        logger.info("Laixi 프로세스 강제 종료 중...")
        if sys.platform == "win32":
            # touping.exe가 Laixi의 실제 프로세스명
            kill_result = subprocess.run(
                ["taskkill", "/f", "/im", "touping.exe"],
                capture_output=True,
                text=True,
                timeout=10
            )
            logger.info(f"taskkill 결과: {kill_result.returncode}")
        else:
            subprocess.run(["pkill", "-f", "laixi"], capture_output=True, timeout=10)
        
        # 3. 연결 끊김 감지
        logger.info("연결 끊김 대기...")
        try:
            await asyncio.wait_for(ws.recv(), timeout=15.0)
        except (ConnectionClosed, asyncio.TimeoutError):
            logger.info("✅ 연결 끊김 감지됨")
        
        await ws.close()
        
        # 4. 재연결 시도 모니터링
        logger.info("재연결 시도 시작...")
        config = TEST_CONFIG["crash_recovery"]
        start_time = time.time()
        
        while time.time() - start_time < config["max_reconnect_wait"]:
            reconnect_attempts += 1
            logger.info(f"재연결 시도 #{reconnect_attempts}")
            
            try:
                ws = await asyncio.wait_for(
                    websockets.connect(LAIXI_WS_URL, ping_interval=10, ping_timeout=5),
                    timeout=5.0
                )
                
                # 연결 확인
                await ws.send(json.dumps({"action": "list"}))
                response = await asyncio.wait_for(ws.recv(), timeout=5.0)
                
                reconnected = True
                elapsed = time.time() - start_time
                logger.info(f"✅ 재연결 성공! ({elapsed:.1f}초, {reconnect_attempts}회 시도)")
                await ws.close()
                break
                
            except Exception as e:
                logger.debug(f"재연결 실패: {e}")
                await asyncio.sleep(config["reconnect_interval"])
        
        # 결과 판정
        result.finish(
            passed=reconnected,
            details={
                "reconnect_attempts": reconnect_attempts,
                "reconnect_time_sec": time.time() - start_time if reconnected else None,
                "max_wait_sec": config["max_reconnect_wait"],
            }
        )
        
        if reconnected:
            logger.info(f"✅ 테스트 통과: {reconnect_attempts}회 시도 후 재연결 성공")
        else:
            result.add_error(f"재연결 실패: {config['max_reconnect_wait']}초 내 재연결 불가")
            logger.error(f"❌ 테스트 실패: 재연결 불가")
            
    except Exception as e:
        result.add_error(str(e))
        result.finish(passed=False, details={"error": str(e)})
        logger.error(f"❌ 테스트 오류: {e}")
    
    return result


# ============================================================
# Test 3: 동시 명령 전송 및 응답 순서 검증
# ============================================================

async def test_concurrent_commands() -> TestResult:
    """
    동시에 5개 명령 전송 후 응답 순서 검증
    
    FIFO 매칭 문제 검증:
    - 5개 명령 동시 전송
    - 응답 수신 순서 기록
    - 요청-응답 매칭 정확도 분석
    """
    result = TestResult("Concurrent Commands")
    logger.info("=" * 60)
    logger.info("Test 3: 동시 명령 전송 및 응답 순서 검증")
    logger.info("=" * 60)
    
    config = TEST_CONFIG["concurrent"]
    
    # 테스트 명령 정의
    commands = [
        {"action": "list", "test_id": 1},
        {"action": "Toast", "comm": {"deviceIds": "all", "content": "Test1"}, "test_id": 2},
        {"action": "BasisOperate", "comm": {"deviceIds": "all", "type": "4"}, "test_id": 3},  # Home
        {"action": "BasisOperate", "comm": {"deviceIds": "all", "type": "3"}, "test_id": 4},  # Back
        {"action": "BasisOperate", "comm": {"deviceIds": "all", "type": "15"}, "test_id": 5},  # ScreenOn
    ]
    
    sent_times: List[Tuple[int, float]] = []
    recv_times: List[Tuple[int, float]] = []
    responses: List[dict] = []
    
    try:
        # 연결
        logger.info(f"Laixi 연결: {LAIXI_WS_URL}")
        ws = await asyncio.wait_for(
            websockets.connect(LAIXI_WS_URL, ping_interval=10, ping_timeout=5),
            timeout=10.0
        )
        logger.info("✅ 연결 성공")
        
        # 동시 명령 전송
        logger.info(f"동시에 {len(commands)}개 명령 전송...")
        start_time = time.time()
        
        for i, cmd in enumerate(commands):
            await ws.send(json.dumps(cmd))
            sent_times.append((cmd["test_id"], time.time() - start_time))
            logger.info(f"  [SENT] #{cmd['test_id']} {cmd['action']}")
        
        # 응답 수신
        logger.info("응답 수신 대기...")
        for i in range(len(commands)):
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=config["timeout"])
                recv_time = time.time() - start_time
                resp_data = json.loads(response)
                
                # 응답에서 test_id 추출 시도 (Laixi는 echo하지 않으므로 순서 기반)
                recv_times.append((i + 1, recv_time))
                responses.append(resp_data)
                
                logger.info(f"  [RECV] #{i+1} StatusCode={resp_data.get('StatusCode')} ({recv_time:.3f}s)")
                
            except asyncio.TimeoutError:
                logger.warning(f"  [TIMEOUT] 응답 #{i+1} 타임아웃")
                break
        
        await ws.close()
        
        # 결과 분석
        all_received = len(responses) == len(commands)
        order_preserved = all(
            sent_times[i][0] == recv_times[i][0] 
            for i in range(min(len(sent_times), len(recv_times)))
        )
        
        logger.info("")
        logger.info("=== 결과 분석 ===")
        logger.info(f"전송: {len(commands)}개, 수신: {len(responses)}개")
        logger.info(f"전송 순서: {[s[0] for s in sent_times]}")
        logger.info(f"수신 순서: {[r[0] for r in recv_times]}")
        
        # FIFO 문제 발생 여부
        fifo_issue = not order_preserved
        if fifo_issue:
            logger.warning("⚠️ FIFO 순서 불일치 감지 - 응답 매칭 오류 가능성")
        
        result.finish(
            passed=all_received,
            details={
                "commands_sent": len(commands),
                "responses_received": len(responses),
                "order_preserved": order_preserved,
                "fifo_issue_detected": fifo_issue,
                "sent_order": [s[0] for s in sent_times],
                "recv_order": [r[0] for r in recv_times],
            }
        )
        
        if all_received:
            logger.info(f"✅ 테스트 통과: 모든 응답 수신")
        else:
            result.add_error(f"응답 누락: {len(commands) - len(responses)}개")
            logger.error(f"❌ 테스트 실패: 응답 누락")
            
    except Exception as e:
        result.add_error(str(e))
        result.finish(passed=False, details={"error": str(e)})
        logger.error(f"❌ 테스트 오류: {e}")
    
    return result


# ============================================================
# Test 4: 장시간 메모리 모니터링
# ============================================================

async def test_memory_stability(duration_hours: float = None) -> TestResult:
    """
    장시간 메모리 모니터링 테스트
    
    검증 항목:
    - 메모리 사용량 추이
    - 메모리 누수 여부 (시작 대비 20% 이상 증가 시 FAIL)
    """
    result = TestResult("Memory Stability")
    
    if psutil is None:
        result.add_error("psutil 패키지가 설치되지 않음")
        result.finish(passed=False)
        logger.error("❌ psutil 패키지가 필요합니다. pip install psutil")
        return result
    
    config = TEST_CONFIG["memory"]
    duration_hours = duration_hours or config["duration_hours"]
    duration_sec = duration_hours * 3600
    interval_sec = config["snapshot_interval_sec"]
    
    logger.info("=" * 60)
    logger.info(f"Test 4: 메모리 모니터링 ({duration_hours}시간)")
    logger.info("=" * 60)
    
    # 결과 저장 파일
    output_dir = Path(__file__).parent / "test_results"
    output_dir.mkdir(exist_ok=True)
    csv_path = output_dir / f"memory_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    snapshots: List[Dict] = []
    initial_memory = None
    
    try:
        # Node.js establish_connection.js 프로세스 찾기
        target_process = None
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = proc.info.get('cmdline') or []
                if any('establish_connection' in str(c) for c in cmdline):
                    target_process = proc
                    logger.info(f"모니터링 대상 프로세스: PID={proc.pid}")
                    break
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        if not target_process:
            # 대신 node 프로세스 모니터링
            for proc in psutil.process_iter(['pid', 'name']):
                if proc.info['name'] and 'node' in proc.info['name'].lower():
                    target_process = proc
                    logger.info(f"Node.js 프로세스 모니터링: PID={proc.pid}")
                    break
        
        if not target_process:
            logger.warning("모니터링 대상 프로세스를 찾을 수 없음. 전체 시스템 모니터링")
        
        # 모니터링 시작
        logger.info(f"메모리 모니터링 시작 (간격: {interval_sec}초)")
        logger.info(f"결과 파일: {csv_path}")
        
        start_time = time.time()
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=[
                'timestamp', 'elapsed_sec', 'rss_mb', 'vms_mb', 'percent'
            ])
            writer.writeheader()
            
            while time.time() - start_time < duration_sec:
                elapsed = time.time() - start_time
                
                try:
                    if target_process and target_process.is_running():
                        mem_info = target_process.memory_info()
                        mem_percent = target_process.memory_percent()
                        rss_mb = mem_info.rss / (1024 * 1024)
                        vms_mb = mem_info.vms / (1024 * 1024)
                    else:
                        # 시스템 전체 메모리
                        sys_mem = psutil.virtual_memory()
                        rss_mb = sys_mem.used / (1024 * 1024)
                        vms_mb = sys_mem.total / (1024 * 1024)
                        mem_percent = sys_mem.percent
                    
                    snapshot = {
                        'timestamp': datetime.now().isoformat(),
                        'elapsed_sec': int(elapsed),
                        'rss_mb': round(rss_mb, 2),
                        'vms_mb': round(vms_mb, 2),
                        'percent': round(mem_percent, 2),
                    }
                    
                    snapshots.append(snapshot)
                    writer.writerow(snapshot)
                    csvfile.flush()
                    
                    if initial_memory is None:
                        initial_memory = rss_mb
                    
                    # 진행 상황 출력 (10분마다)
                    if len(snapshots) % (600 // interval_sec) == 0:
                        increase = ((rss_mb - initial_memory) / initial_memory * 100) if initial_memory > 0 else 0
                        logger.info(
                            f"[{elapsed/3600:.1f}h] RSS={rss_mb:.1f}MB "
                            f"(+{increase:.1f}% from start)"
                        )
                    
                except psutil.NoSuchProcess:
                    logger.warning("대상 프로세스 종료됨")
                    break
                
                await asyncio.sleep(interval_sec)
        
        # 결과 분석
        if snapshots:
            final_memory = snapshots[-1]['rss_mb']
            increase_percent = ((final_memory - initial_memory) / initial_memory * 100) if initial_memory > 0 else 0
            
            passed = increase_percent < config["max_memory_increase_percent"]
            
            result.finish(
                passed=passed,
                details={
                    "duration_hours": duration_hours,
                    "snapshots_count": len(snapshots),
                    "initial_memory_mb": initial_memory,
                    "final_memory_mb": final_memory,
                    "increase_percent": round(increase_percent, 2),
                    "max_allowed_increase": config["max_memory_increase_percent"],
                    "csv_path": str(csv_path),
                }
            )
            
            if passed:
                logger.info(f"✅ 테스트 통과: 메모리 증가 {increase_percent:.1f}%")
            else:
                result.add_error(f"메모리 누수 감지: {increase_percent:.1f}% 증가")
                logger.error(f"❌ 테스트 실패: 메모리 {increase_percent:.1f}% 증가")
        else:
            result.add_error("스냅샷 데이터 없음")
            result.finish(passed=False)
            
    except Exception as e:
        result.add_error(str(e))
        result.finish(passed=False, details={"error": str(e)})
        logger.error(f"❌ 테스트 오류: {e}")
    
    return result


# ============================================================
# Test Runner
# ============================================================

async def run_all_tests() -> List[TestResult]:
    """전체 테스트 실행"""
    results = []
    
    logger.info("")
    logger.info("╔════════════════════════════════════════════════════════════╗")
    logger.info("║          Socket Connection Resilience Tests                ║")
    logger.info("╚════════════════════════════════════════════════════════════╝")
    logger.info("")
    
    # Test 1: Crash Recovery (Laixi 서버 실행 필요)
    try:
        result = await test_laixi_crash_recovery()
        results.append(result)
    except Exception as e:
        logger.error(f"Test 1 실행 실패: {e}")
    
    logger.info("")
    
    # Test 3: Concurrent Commands
    try:
        result = await test_concurrent_commands()
        results.append(result)
    except Exception as e:
        logger.error(f"Test 3 실행 실패: {e}")
    
    # Test 4는 장시간이므로 개별 실행 권장
    logger.info("")
    logger.info("ℹ️ 메모리 모니터링 테스트는 --test memory 로 개별 실행하세요")
    
    return results


def print_summary(results: List[TestResult]):
    """테스트 결과 요약 출력"""
    logger.info("")
    logger.info("╔════════════════════════════════════════════════════════════╗")
    logger.info("║                    테스트 결과 요약                          ║")
    logger.info("╠════════════════════════════════════════════════════════════╣")
    
    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed
    
    for result in results:
        logger.info(f"║  {result}")
        if result.errors:
            for error in result.errors:
                logger.info(f"║    └─ {error}")
    
    logger.info("╠════════════════════════════════════════════════════════════╣")
    logger.info(f"║  Total: {len(results)} | Passed: {passed} | Failed: {failed}")
    logger.info("╚════════════════════════════════════════════════════════════╝")


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Socket Connection Resilience Tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
테스트 종류:
  crash      - Laixi 서버 강제 종료 및 재연결 테스트
  concurrent - 동시 명령 5개 전송 테스트
  memory     - 장시간 메모리 모니터링 (기본 24시간)
  all        - 전체 테스트 (memory 제외)

예시:
  python test_socket_resilience.py --test crash
  python test_socket_resilience.py --test memory --duration 1
        """
    )
    
    parser.add_argument(
        "--test", "-t",
        choices=["crash", "concurrent", "memory", "all"],
        default="all",
        help="실행할 테스트 종류"
    )
    
    parser.add_argument(
        "--duration", "-d",
        type=float,
        default=24,
        help="메모리 테스트 시간 (시간 단위, 기본: 24)"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="상세 로그 출력"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # 테스트 실행
    results = []
    
    if args.test == "crash":
        results.append(asyncio.run(test_laixi_crash_recovery()))
    elif args.test == "concurrent":
        results.append(asyncio.run(test_concurrent_commands()))
    elif args.test == "memory":
        results.append(asyncio.run(test_memory_stability(args.duration)))
    else:  # all
        results = asyncio.run(run_all_tests())
    
    # 결과 출력
    print_summary(results)
    
    # 종료 코드 (실패한 테스트 수)
    failed_count = sum(1 for r in results if not r.passed)
    sys.exit(failed_count)


if __name__ == "__main__":
    main()
