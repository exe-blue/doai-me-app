"""
Laixi Protocol Explorer
화면 스트리밍 API를 탐색하기 위한 도구

실행: python tools/laixi_protocol_explorer.py

목적:
1. Laixi WebSocket 연결 및 명령 테스트
2. 알려진/추측 가능한 action들 탐색
3. Binary 응답 분석
"""

import asyncio
import json
import sys
from typing import Optional, Any
from datetime import datetime

try:
    import websockets
except ImportError:
    print("websockets 패키지 필요: pip install websockets")
    sys.exit(1)


LAIXI_WS_URL = "ws://127.0.0.1:22221/"

# 탐색할 action 목록 (알려진 것 + 추측)
ACTIONS_TO_EXPLORE = [
    # 알려진 action들
    {"action": "list"},
    {"action": "List"},
    
    # 화면 관련 추측 action들
    {"action": "StartMonitor", "comm": {"deviceIds": "all"}},
    {"action": "start_monitor", "comm": {"deviceIds": "all"}},
    {"action": "startMonitor", "comm": {"deviceIds": "all"}},
    {"action": "Monitor", "comm": {"deviceIds": "all"}},
    {"action": "monitor", "comm": {"deviceIds": "all"}},
    {"action": "StartStream", "comm": {"deviceIds": "all"}},
    {"action": "startStream", "comm": {"deviceIds": "all"}},
    {"action": "Stream", "comm": {"deviceIds": "all"}},
    {"action": "stream", "comm": {"deviceIds": "all"}},
    {"action": "StartVideo", "comm": {"deviceIds": "all"}},
    {"action": "Video", "comm": {"deviceIds": "all"}},
    {"action": "StartScreen", "comm": {"deviceIds": "all"}},
    {"action": "Screen", "comm": {"deviceIds": "all"}},
    {"action": "GetScreen", "comm": {"deviceIds": "all"}},
    {"action": "getScreen", "comm": {"deviceIds": "all"}},
    {"action": "ScreenCapture", "comm": {"deviceIds": "all"}},
    {"action": "Capture", "comm": {"deviceIds": "all"}},
    {"action": "StartMirror", "comm": {"deviceIds": "all"}},
    {"action": "Mirror", "comm": {"deviceIds": "all"}},
    {"action": "LiveScreen", "comm": {"deviceIds": "all"}},
    {"action": "LiveView", "comm": {"deviceIds": "all"}},
    {"action": "Preview", "comm": {"deviceIds": "all"}},
    {"action": "StartPreview", "comm": {"deviceIds": "all"}},
    
    # 영상/투핑 관련
    {"action": "TouPing", "comm": {"deviceIds": "all"}},
    {"action": "StartCast", "comm": {"deviceIds": "all"}},
    {"action": "Cast", "comm": {"deviceIds": "all"}},
    
    # 도움말/목록
    {"action": "help"},
    {"action": "Help"},
    {"action": "actions"},
    {"action": "Actions"},
    {"action": "GetActions"},
    {"action": "ListActions"},
    {"action": "info"},
    {"action": "Info"},
    {"action": "GetInfo"},
    {"action": "version"},
    {"action": "Version"},
    {"action": "GetVersion"},
]


def hex_dump(data: bytes, length: int = 100) -> str:
    """바이너리 데이터 Hex Dump"""
    dump_data = data[:length]
    hex_str = " ".join(f"{b:02X}" for b in dump_data)
    
    # ASCII 표현
    ascii_str = "".join(chr(b) if 32 <= b < 127 else "." for b in dump_data)
    
    result = f"Length: {len(data)} bytes\n"
    result += f"First {length} bytes (Hex):\n"
    
    # 16바이트씩 출력
    for i in range(0, min(len(dump_data), length), 16):
        chunk = dump_data[i:i+16]
        hex_part = " ".join(f"{b:02X}" for b in chunk)
        ascii_part = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
        result += f"{i:04X}: {hex_part:<48} {ascii_part}\n"
    
    return result


async def explore_action(ws, action: dict) -> dict:
    """단일 action 탐색"""
    result = {
        "action": action,
        "success": False,
        "response_type": None,
        "response": None,
        "error": None
    }
    
    try:
        # 명령 전송
        cmd = json.dumps(action)
        await ws.send(cmd)
        
        # 응답 수신 (타임아웃 3초)
        response = await asyncio.wait_for(ws.recv(), timeout=3.0)
        
        # 응답 타입 확인
        if isinstance(response, bytes):
            result["response_type"] = "binary"
            result["response"] = hex_dump(response)
            result["success"] = True
        else:
            result["response_type"] = "text"
            try:
                parsed = json.loads(response)
                result["response"] = parsed
                
                # 성공 여부 판단
                if parsed.get("StatusCode") == 200:
                    result["success"] = True
                elif "error" not in str(parsed).lower():
                    result["success"] = True
                    
            except json.JSONDecodeError:
                result["response"] = response[:500]
                result["success"] = True
                
    except asyncio.TimeoutError:
        result["error"] = "Timeout (3s)"
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def listen_for_binary(ws, duration: float = 5.0):
    """
    바이너리 데이터 수신 대기
    
    화면 스트리밍이 시작되면 지속적으로 바이너리 데이터가 올 수 있음
    """
    print(f"\n📡 바이너리 데이터 수신 대기 ({duration}초)...")
    
    start = asyncio.get_event_loop().time()
    messages = []
    
    try:
        while asyncio.get_event_loop().time() - start < duration:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=0.5)
                
                if isinstance(msg, bytes):
                    messages.append({
                        "type": "binary",
                        "size": len(msg),
                        "preview": hex_dump(msg, 50)
                    })
                    print(f"  📦 Binary: {len(msg)} bytes")
                else:
                    messages.append({
                        "type": "text",
                        "data": msg[:200]
                    })
                    print(f"  📝 Text: {msg[:100]}...")
                    
            except asyncio.TimeoutError:
                continue
                
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    return messages


async def main():
    print("=" * 60)
    print("🔍 Laixi Protocol Explorer")
    print("=" * 60)
    print(f"Target: {LAIXI_WS_URL}")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)
    
    try:
        async with websockets.connect(LAIXI_WS_URL) as ws:
            print("✅ WebSocket 연결 성공\n")
            
            # 1. 기기 목록 조회
            print("📱 기기 목록 조회...")
            await ws.send(json.dumps({"action": "list"}))
            response = await asyncio.wait_for(ws.recv(), timeout=5.0)
            
            try:
                data = json.loads(response)
                if data.get("StatusCode") == 200:
                    devices = json.loads(data.get("result", "[]"))
                    print(f"   연결된 기기: {len(devices)}대")
                    for dev in devices[:5]:  # 최대 5개만
                        print(f"   - {dev.get('deviceId', 'unknown')} ({dev.get('name', 'unknown')})")
            except:
                print(f"   응답: {response[:200]}")
            
            print("\n" + "-" * 60)
            print("🔍 Action 탐색 시작...")
            print("-" * 60)
            
            # 2. 각 action 탐색
            interesting_results = []
            
            for action in ACTIONS_TO_EXPLORE:
                action_name = action.get("action", "unknown")
                print(f"\n🎯 Testing: {action_name}")
                
                result = await explore_action(ws, action)
                
                if result["success"]:
                    print(f"   ✅ 성공!")
                    if result["response_type"] == "binary":
                        print(f"   📦 바이너리 응답!")
                        interesting_results.append(result)
                    elif result["response"]:
                        resp = result["response"]
                        if isinstance(resp, dict):
                            status = resp.get("StatusCode", "N/A")
                            print(f"   StatusCode: {status}")
                            if status == 200:
                                interesting_results.append(result)
                        else:
                            print(f"   Response: {str(resp)[:100]}")
                elif result["error"]:
                    print(f"   ⏳ {result['error']}")
                else:
                    print(f"   ❌ 실패")
                
                # 연결 상태 유지를 위한 짧은 대기
                await asyncio.sleep(0.2)
            
            # 3. 바이너리 수신 테스트
            print("\n" + "-" * 60)
            print("🎥 바이너리 스트림 테스트...")
            print("-" * 60)
            
            # StartMonitor 등 관련 명령 후 바이너리 수신 대기
            test_actions = [
                {"action": "StartMonitor", "comm": {"deviceIds": "all"}},
                {"action": "Monitor", "comm": {"deviceIds": "all", "start": True}},
                {"action": "StartStream", "comm": {"deviceIds": "all"}},
            ]
            
            for action in test_actions:
                print(f"\n🎯 {action['action']} 후 바이너리 대기...")
                await ws.send(json.dumps(action))
                
                # 짧은 대기 후 응답 확인
                try:
                    resp = await asyncio.wait_for(ws.recv(), timeout=1.0)
                    if isinstance(resp, bytes):
                        print(f"   🎉 바이너리 응답 발견!")
                        print(hex_dump(resp))
                        
                        # 추가 데이터 수신
                        binary_data = await listen_for_binary(ws, 3.0)
                        if binary_data:
                            print(f"   총 {len(binary_data)}개 메시지 수신")
                    else:
                        print(f"   Text: {resp[:200]}")
                except asyncio.TimeoutError:
                    print(f"   ⏳ 타임아웃")
            
            # 4. 결과 요약
            print("\n" + "=" * 60)
            print("📊 탐색 결과 요약")
            print("=" * 60)
            
            print(f"\n성공한 action: {len(interesting_results)}개")
            for r in interesting_results:
                action_name = r["action"].get("action", "unknown")
                resp_type = r["response_type"]
                print(f"  - {action_name}: {resp_type}")
                
                if resp_type == "binary":
                    print(f"    {r['response'][:200]}")
            
            # 5. 포트 스캔 제안
            print("\n" + "-" * 60)
            print("💡 추가 탐색 제안:")
            print("-" * 60)
            print("1. Laixi 앱이 다른 포트로 비디오 스트리밍할 가능성")
            print("   - 일반적인 RTSP: 554, 8554")
            print("   - 일반적인 스트리밍: 5555, 8080, 9000")
            print("2. ADB forward로 기기의 미러링 포트 접근")
            print("   - scrcpy 프로토콜: 27183")
            print("3. Laixi PDF 문서 확인 필요")
            
    except ConnectionRefusedError:
        print("❌ Laixi 연결 실패!")
        print("   - touping.exe가 실행 중인지 확인하세요")
        print("   - 방화벽에서 22221 포트 허용 확인")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())


