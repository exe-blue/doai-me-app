# Socket Connection Manual Tests

물리적 테스트가 필요한 시나리오의 수동 테스트 가이드입니다.

---

## 테스트 환경 준비

### 필수 조건

- Windows 10/11 (관리자 권한)
- Laixi 서버 실행 중 (`touping.exe`)
- `establish_connection.js` 실행 중
- USB 허브에 테스트 디바이스 연결

### 로그 모니터링 방법

```powershell
# PowerShell에서 establish_connection.js 실행 (로그 확인용)
cd d:\exe.blue\aifarm\gateway\scripts\laixi
node establish_connection.js
```

---

## Test 2: 네트워크 어댑터 비활성화

> **목적:** ping/pong 타임아웃 및 TCP Half-Open 상태 감지 검증

### 준비 사항

- [ ] 관리자 권한 PowerShell 열기
- [ ] `establish_connection.js` 실행 중 확인
- [ ] 네트워크 어댑터 이름 확인 (`Get-NetAdapter`)

### 테스트 절차

#### Step 1: 네트워크 어댑터 확인

```powershell
# 어댑터 목록 확인
Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object Name, Status
```

출력 예시:
```
Name      Status
----      ------
Ethernet  Up
Wi-Fi     Up
```

#### Step 2: 현재 연결 상태 확인

- establish_connection.js 로그에서 `연결 성공` 또는 `Heartbeat` 메시지 확인
- 로그 예시:
  ```
  [14:30:00] ✅ 연결 성공! (125ms)
  [14:30:05] 💓 Heartbeat #1 - 연결 유지 중 (5대 온라인)
  ```

#### Step 3: 네트워크 비활성화

```powershell
# 관리자 권한 필요
netsh interface set interface "Ethernet" disable
```

또는 PowerShell:
```powershell
Disable-NetAdapter -Name "Ethernet" -Confirm:$false
```

#### Step 4: 로그 모니터링 (10초)

**예상 로그:**
```
[14:30:15] ⚠️ 연결 종료 (code=1006)
[14:30:15] ℹ️ 재연결 시도 1/10...
[14:30:18] ❌ 재연결 실패: ECONNREFUSED
```

**확인 항목:**
- [ ] ping/pong 타임아웃 감지 (개선 후)
- [ ] close 이벤트 발생
- [ ] 재연결 시도 시작

#### Step 5: 네트워크 재활성화

```powershell
netsh interface set interface "Ethernet" enable
```

또는 PowerShell:
```powershell
Enable-NetAdapter -Name "Ethernet" -Confirm:$false
```

#### Step 6: 연결 복구 확인

**예상 로그:**
```
[14:30:30] ℹ️ 재연결 시도 4/10...
[14:30:33] ✅ 연결 성공! (89ms)
[14:30:33] ✅ Heartbeat 시작
```

### 판정 기준

| 결과 | 조건 |
|------|------|
| **PASS** | 네트워크 복구 후 30초 내 재연결 성공 |
| **FAIL** | 무한 대기 또는 프로세스 종료 |
| **WARN** | 30초 초과 60초 이내 재연결 |

### 체크리스트

- [ ] 네트워크 비활성화 시 연결 끊김 감지됨
- [ ] 재연결 시도 로그 출력됨
- [ ] 네트워크 복구 후 자동 재연결 성공
- [ ] Heartbeat 재시작됨

### 결과 기록

```
테스트 일시: ____년 __월 __일 __:__
테스터: ______________
결과: PASS / FAIL / WARN
비고: ______________
```

---

## Test 5: USB 허브 전원 차단/복구

> **목적:** 디바이스 수 변경 감지 및 재검증 로직 검증

### 준비 사항

- [ ] USB 허브에 최소 2대 이상 디바이스 연결
- [ ] `establish_connection.js` Heartbeat 실행 중
- [ ] USB 허브 전원 케이블 접근 가능

### 테스트 절차

#### Step 1: 초기 상태 확인

```
[14:40:00] ✅ Phase 2: 5개 디바이스 발견
[14:40:05] 💓 Heartbeat #1 - 연결 유지 중 (5대 온라인)
```

**기록:**
- 초기 디바이스 수: ___대

#### Step 2: USB 허브 전원 분리

- 물리적으로 USB 허브 전원 케이블 분리
- 시간 기록: __:__

#### Step 3: 로그 모니터링 (5초)

**예상 로그:**
```
[14:40:10] 💓 Heartbeat #2 - 연결 유지 중 (0대 온라인)
[14:40:10] ⚠️ 디바이스 수 변경: 5 → 0
```

**확인 항목:**
- [ ] 디바이스 수 감소 감지
- [ ] 경고 로그 출력
- [ ] 오프라인 디바이스 마킹 (개선 후)

#### Step 4: USB 허브 전원 재연결

- 물리적으로 USB 허브 전원 케이블 연결
- 시간 기록: __:__

#### Step 5: 디바이스 복구 확인 (60초)

**예상 로그:**
```
[14:40:30] 💓 Heartbeat #5 - 연결 유지 중 (5대 온라인)
[14:40:30] ⚠️ 디바이스 수 변경: 0 → 5
[14:40:31] ℹ️ 새 디바이스 검증 시작...  # 개선 후
```

**확인 항목:**
- [ ] 디바이스 수 증가 감지
- [ ] 새 디바이스 재검증 (개선 후)
- [ ] 초기화 명령 재실행 (개선 후)

### 판정 기준

| 결과 | 조건 |
|------|------|
| **PASS** | 전원 복구 후 60초 내 디바이스 복구 |
| **FAIL** | 디바이스 영구 오프라인 또는 재검증 미실행 |
| **WARN** | 복구되었으나 재검증 미실행 |

### 체크리스트

- [ ] 전원 분리 시 디바이스 수 감소 감지됨
- [ ] 전원 연결 시 디바이스 수 증가 감지됨
- [ ] 모든 디바이스 정상 복구됨
- [ ] 새 디바이스 재검증 실행됨 (개선 후)

### 결과 기록

```
테스트 일시: ____년 __월 __일 __:__
테스터: ______________
초기 디바이스 수: ___대
복구 후 디바이스 수: ___대
복구 소요 시간: ___초
결과: PASS / FAIL / WARN
비고: ______________
```

---

## 테스트 결과 종합

### 결과 요약표

| 테스트 | 날짜 | 결과 | 비고 |
|--------|------|------|------|
| Test 2: 네트워크 어댑터 | | | |
| Test 5: USB 허브 | | | |

### 발견된 이슈

1. **이슈 제목**
   - 발생 조건:
   - 증상:
   - 재현 단계:

### 개선 필요 사항

- [ ] ping/pong 미설정으로 TCP Half-Open 감지 불가 (개선 예정)
- [ ] 디바이스 재검증 로직 미구현 (개선 예정)
- [ ] Exponential Backoff 미적용 (개선 예정)

---

## 부록: 유용한 명령어

### Windows 네트워크 관리

```powershell
# 어댑터 목록
Get-NetAdapter

# 어댑터 비활성화
Disable-NetAdapter -Name "Ethernet" -Confirm:$false

# 어댑터 활성화
Enable-NetAdapter -Name "Ethernet" -Confirm:$false

# 연결 상태 확인
Test-NetConnection -ComputerName 127.0.0.1 -Port 22221
```

### Laixi 프로세스 관리

```powershell
# Laixi 프로세스 확인
Get-Process | Where-Object {$_.Name -like "*touping*" -or $_.Name -like "*laixi*"}

# Laixi 강제 종료
taskkill /f /im touping.exe

# 포트 사용 확인
netstat -ano | findstr 22221
```

### USB 디바이스 확인

```powershell
# USB 디바이스 목록
Get-PnpDevice -Class USB | Where-Object {$_.Status -eq "OK"}

# ADB 디바이스 목록
adb devices
```
