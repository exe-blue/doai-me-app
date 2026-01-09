# Runbook: ADB 문제해결

> Android Debug Bridge 관련 문제 진단 및 해결

## 기본 명령어

### 연결된 디바이스 확인
```bash
adb devices -l
```

### ADB 서버 재시작
```bash
adb kill-server
adb start-server
adb devices
```

---

## 일반적인 문제

### 1. 디바이스가 "unauthorized"로 표시

**증상:** `adb devices`에서 "unauthorized" 상태

**원인:** 디바이스에서 USB 디버깅 승인이 안됨

**해결:**
```bash
# ADB 키 재설정
adb kill-server
rm -rf ~/.android/adbkey*
adb start-server
# 디바이스 화면에서 "USB 디버깅 허용" 승인
```

### 2. 디바이스가 "offline"으로 표시

**증상:** `adb devices`에서 "offline" 상태

**원인:** 
- USB 연결 불안정
- ADB 데몬 문제

**해결:**
```bash
# USB 케이블/허브 재연결
# ADB 재시작
adb kill-server
adb start-server

# 특정 디바이스 재연결
adb -s <device-id> reconnect
```

### 3. 디바이스가 목록에 없음

**증상:** `adb devices` 빈 목록

**원인:**
- USB 드라이버 문제
- USB 디버깅 비활성화
- USB 모드가 MTP/PTP

**해결:**
```bash
# USB 모드 확인 (디바이스에서)
# 설정 > 개발자 옵션 > USB 설정 > 파일 전송(MTP) 또는 PTP

# Linux에서 udev 규칙 확인
cat /etc/udev/rules.d/51-android.rules

# 규칙 추가 (Samsung 예시)
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="04e8", MODE="0666", GROUP="plugdev"' | sudo tee /etc/udev/rules.d/51-android.rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### 4. 다수의 디바이스 관리

**증상:** 여러 디바이스 중 특정 디바이스 명령 실패

**해결:**
```bash
# 특정 디바이스 지정
adb -s <device-id> shell

# 모든 디바이스에 명령 실행 (스크립트)
for device in $(adb devices | grep -v "List" | awk '{print $1}'); do
    adb -s $device shell getprop ro.product.model
done
```

---

## 폰보드 환경 특이사항

### 배터리 없는 환경
- 전원 공급이 끊기면 디바이스가 꺼짐
- USB 허브 품질이 중요

### 권장 사항
```bash
# 디바이스 상태 모니터링
adb -s <device-id> shell dumpsys battery

# 화면 항상 켜짐 설정
adb -s <device-id> shell settings put global stay_on_while_plugged_in 3
```

---

## ADB over WiFi (선택)

### 설정
```bash
# USB 연결 상태에서
adb tcpip 5555
adb connect <device-ip>:5555

# USB 분리 후에도 연결 유지
```

### 재연결
```bash
adb connect <device-ip>:5555
```

---

## 로깅

### Logcat 확인
```bash
# 전체 로그
adb -s <device-id> logcat

# 특정 태그 필터
adb -s <device-id> logcat -s AutoX:* DoAi:*

# 파일로 저장
adb -s <device-id> logcat -d > device_log.txt
```

---

## 관련 문서

- [시스템 복구](./recover.md)
- [Tailscale 설정](./tailscale.md)

