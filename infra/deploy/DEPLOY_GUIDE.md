# AIFarm 600대 서버 배포 가이드

## 🚀 빠른 시작

### Windows에서 한 번에 배포하기
```cmd
cd d:\exe.blue\ai-fram\deploy
deploy_to_vultr.bat
```

---

## 📋 단계별 수동 설치

### Step 1: Vultr 서버 초기 설정

#### 1.1 서버 SSH 접속
```bash
ssh root@158.247.210.152
```

#### 1.2 설정 스크립트 실행

**⚠️ 중요: 보안을 위해 반드시 검증된 외부 스크립트를 사용하세요!**

인라인 스크립트 대신 저장소의 `deploy/aifarm_setup.sh`를 다운로드하여 실행합니다.
이 스크립트는 다음 보안 모범 사례를 따릅니다:
- 전용 비-root 서비스 사용자(`aifarm`) 생성
- 적절한 파일 권한 설정
- root로 서비스 실행 방지
- systemd 보안 강화 옵션 적용

```bash
# 방법 1: GitHub에서 직접 다운로드 (권장)
curl -fsSL https://raw.githubusercontent.com/exe-blue/youtube_automation_human_bot/main/deploy/aifarm_setup.sh -o /tmp/aifarm_setup.sh

# 다운로드한 스크립트 내용 확인 (실행 전 검토 권장)
less /tmp/aifarm_setup.sh

# 실행 권한 부여 및 실행 (sudo 사용)
chmod +x /tmp/aifarm_setup.sh
sudo bash /tmp/aifarm_setup.sh
```

```bash
# 방법 2: 로컬에서 SCP로 업로드 후 실행
# (로컬 PC에서)
scp d:\exe.blue\ai-fram\deploy\aifarm_setup.sh root@158.247.210.152:/tmp/

# (서버에서)
chmod +x /tmp/aifarm_setup.sh
sudo bash /tmp/aifarm_setup.sh
```

**스크립트가 수행하는 작업:**
1. 시스템 패키지 업데이트 및 필수 패키지 설치
2. 전용 서비스 사용자 `aifarm` 생성 (시스템 계정, 로그인 불가)
3. `/opt/aifarm` 디렉토리 생성 및 `aifarm` 사용자 소유권 설정
4. Python 가상환경 생성 (aifarm 사용자 권한으로)
5. 방화벽 설정 (SSH 22, 웹 8080 허용, ADB 5555는 기본적으로 차단)
6. systemd 서비스 등록 (`aifarm` 사용자로 실행, 보안 강화 옵션 적용)

#### 1.3 프로젝트 파일 업로드 (로컬 PC에서)

> **참고:** `aifarm_setup.sh` 스크립트가 GitHub에서 자동으로 클론합니다.
> 수동으로 업로드하는 경우에만 아래 명령을 사용하세요.

```cmd
scp -r d:\exe.blue\ai-fram\aifarm root@158.247.210.152:/tmp/

# 서버에서 파일 이동 및 권한 설정 (aifarm 사용자 소유로)
sudo mv /tmp/aifarm/* /opt/aifarm/
sudo chown -R aifarm:aifarm /opt/aifarm
```

#### 1.4 환경변수 설정 (서버에서)

> **⚠️ 보안:** `.env` 파일은 `aifarm` 사용자만 읽을 수 있도록 권한을 설정합니다.

```bash
# aifarm 사용자로 환경변수 파일 편집
sudo -u aifarm nano /opt/aifarm/.env
```
내용:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
HOST=0.0.0.0
PORT=8080
MAX_WORKERS=100
```

파일 권한 설정:
```bash
# 소유자만 읽기/쓰기 가능하도록 설정
sudo chmod 600 /opt/aifarm/.env
sudo chown aifarm:aifarm /opt/aifarm/.env
```

#### 1.5 서비스 확인 및 시작

> **참고:** `aifarm_setup.sh` 스크립트가 이미 systemd 서비스를 등록했습니다.
> 서비스는 `aifarm` 사용자(비-root)로 실행되며, 보안 강화 옵션이 적용되어 있습니다.

스크립트로 생성된 서비스 구성 확인:
```bash
# 서비스 파일 내용 확인 (User=aifarm인지 확인)
cat /etc/systemd/system/aifarm.service
```

예상되는 서비스 구성 (보안 강화 적용):
```ini
[Unit]
Description=AIFarm Server
After=network.target

[Service]
Type=simple
User=aifarm           # ✅ 비-root 사용자로 실행
Group=aifarm
WorkingDirectory=/opt/aifarm
Environment=PATH=/opt/aifarm/venv/bin
ExecStart=/opt/aifarm/venv/bin/python run_intranet.py
Restart=always
RestartSec=10

# 보안 강화 옵션
NoNewPrivileges=yes   # 권한 상승 방지
PrivateTmp=yes        # 격리된 /tmp 사용
ProtectSystem=strict  # 시스템 파일 보호
ReadWritePaths=/opt/aifarm

[Install]
WantedBy=multi-user.target
```

서비스 시작 (sudo 필요):
```bash
sudo systemctl start aifarm
```

#### 1.6 확인
```bash
sudo systemctl status aifarm
curl http://localhost:8080/health

# 서비스가 aifarm 사용자로 실행 중인지 확인
ps aux | grep aifarm
```

---

### Step 2: 네트워크 설정 (현장)

#### 2.1 VLAN 설정 (관리형 스위치)
```
vlan 10 name AP1-Devices
vlan 20 name AP2-Devices
vlan 30 name AP3-Devices
vlan 40 name AP4-Devices
vlan 50 name AP5-Devices
vlan 60 name AP6-Devices
```

#### 2.2 AP 설정 (EAP-673)

| AP | SSID | VLAN | 채널 | IP 범위 |
|----|------|------|------|---------|
| 1 | AIFARM-AP1 | 10 | 36 | 10.0.10.1-100 |
| 2 | AIFARM-AP2 | 20 | 52 | 10.0.20.1-100 |
| 3 | AIFARM-AP3 | 30 | 100 | 10.0.30.1-100 |
| 4 | AIFARM-AP4 | 40 | 116 | 10.0.40.1-100 |
| 5 | AIFARM-AP5 | 50 | 132 | 10.0.50.1-100 |
| 6 | AIFARM-AP6 | 60 | 149 | 10.0.60.1-100 |

#### 2.3 DHCP 서버 설정
```
subnet 10.0.10.0 netmask 255.255.255.0 {
  range 10.0.10.1 10.0.10.100;
  option routers 10.0.10.254;
  option domain-name-servers 8.8.8.8;
}
# VLAN 20-60도 동일하게 설정
```

---

### Step 3: Vultr ↔ 현장 연결 (Tailscale)

#### Vultr 서버에서:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --advertise-routes=10.0.0.0/8 --accept-routes
```

#### 현장 PC에서:
```bash
# Linux/Mac
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --accept-routes

# Windows - Tailscale 앱 설치 후 로그인
```

---

### Step 4: 폰보드 설정

#### 4.1 WiFi 연결
- 폰보드 01-05 → AIFARM-AP1
- 폰보드 06-10 → AIFARM-AP2
- (이하 동일)

#### 4.2 ADB over WiFi 활성화
```bash
# USB 연결 상태에서
adb tcpip 5555
```

#### 4.3 연결 테스트 (Vultr 서버에서)
```bash
cd /opt/aifarm
source venv/bin/activate
python -c "
from src.controller.device_manager import DeviceManager
dm = DeviceManager()
dm.connect_all(max_workers=50)
print(f'연결된 디바이스: {len(dm.get_connected_ips())}')
"
```

---

### Step 5: 서비스 시작

#### 5.1 대시보드 접속
```
http://158.247.210.152:8080/dashboard
```

#### 5.2 활동 시작
```bash
cd /opt/aifarm
source venv/bin/activate

python -c "
from src.agent.scheduler import DeviceScheduler
from src.agent.activity_manager import ActivityManager

scheduler = DeviceScheduler(total_devices=600)
manager = ActivityManager(scheduler)
manager.start_all_activities()
"
```

#### 5.3 모니터링
```bash
# 로그 확인
journalctl -u aifarm -f

# 상태 확인
curl http://localhost:8080/devices/stats
```

---

## 🔒 보안: ADB 포트 설정

**⚠️ 중요: ADB 포트 5555는 반드시 제한된 접근만 허용해야 합니다!**

ADB(Android Debug Bridge)는 디바이스에 대한 완전한 제어 권한을 제공하므로, 포트 5555를 모든 IP에 개방하면 심각한 보안 위험이 됩니다.

### 권장 옵션

**Option 1: 특정 IP만 허용 (권장)**
```bash
# 관리 서버/VPN IP만 허용
ufw allow from YOUR_MANAGEMENT_IP to any port 5555 proto tcp

# 예: Tailscale VPN 네트워크만 허용
ufw allow from 100.64.0.0/10 to any port 5555 proto tcp
```

**Option 2: VPN/SSH 터널 사용 (가장 안전)**
```bash
# ADB 포트를 방화벽에서 열지 않음
# SSH 터널을 통해 접근:
ssh -L 5555:10.0.10.1:5555 user@server
adb connect localhost:5555
```

**Option 3: Tailscale만 사용**
- Tailscale 설치 후 VPN 내부에서만 접근
- 공인 IP로는 ADB 접근 불가

### 설정 확인
```bash
# 현재 UFW 규칙 확인
ufw status numbered

# 5555 포트가 모든 IP에 열려있는지 확인
ufw status | grep 5555
# "5555/tcp ALLOW Anywhere" 가 보이면 보안 위험!
```

---

## 🔧 문제 해결

### 디바이스 연결 안됨
1. 핑 테스트: `ping 10.0.10.1`
2. ADB 상태: `adb devices`
3. 방화벽: `ufw status`

### 성능 저하
1. `MAX_WORKERS` 줄이기 (50)
2. 배치 크기 줄이기
3. AP당 디바이스 분산 확인

### 서비스 재시작
```bash
sudo systemctl restart aifarm
```

---

## 🛡️ 보안 모범 사례 (Least Privilege)

### 왜 비-root 사용자로 실행해야 하나요?

서비스를 root로 실행하면 다음과 같은 위험이 있습니다:
- **권한 상승 공격**: 서비스 취약점이 시스템 전체 권한으로 악용될 수 있음
- **실수로 인한 시스템 손상**: 버그로 인한 피해가 전체 시스템에 영향
- **감사 및 추적 어려움**: 모든 작업이 root로 기록됨

### 이 가이드에서 적용된 보안 조치

| 보안 조치 | 설명 |
|-----------|------|
| 전용 서비스 사용자 | `aifarm` 사용자 (시스템 계정, 로그인 불가) |
| 최소 권한 원칙 | 서비스는 `/opt/aifarm`에만 쓰기 권한 |
| NoNewPrivileges | 프로세스가 새 권한을 획득하지 못함 |
| PrivateTmp | 격리된 /tmp 디렉토리 사용 |
| ProtectSystem=strict | 시스템 파일 읽기 전용 |
| 환경 파일 보호 | `.env` 파일 권한 600 (소유자만 읽기/쓰기) |

### sudo 사용 가이드

비-root 사용자로 로그인한 경우, 관리 작업에는 `sudo`를 사용합니다:

```bash
# 서비스 관리 (sudo 필요)
sudo systemctl start aifarm
sudo systemctl stop aifarm
sudo systemctl restart aifarm
sudo systemctl status aifarm

# 로그 확인 (sudo 필요할 수 있음)
sudo journalctl -u aifarm -f

# aifarm 사용자로 명령 실행
sudo -u aifarm /opt/aifarm/venv/bin/python script.py

# 파일 편집 (aifarm 소유 파일)
sudo -u aifarm nano /opt/aifarm/config.yaml
# 또는
sudo nano /opt/aifarm/config.yaml  # 후에 chown 필요
```

### 보안 점검 체크리스트

```bash
# 1. 서비스가 root로 실행되고 있지 않은지 확인
ps aux | grep aifarm
# USER 열이 'aifarm'이어야 함

# 2. 파일 권한 확인
ls -la /opt/aifarm/.env
# -rw------- 1 aifarm aifarm ... .env

# 3. 디렉토리 소유권 확인
ls -la /opt/ | grep aifarm
# drwxr-xr-x ... aifarm aifarm ... aifarm

# 4. ADB 포트가 공개되지 않았는지 확인
sudo ufw status | grep 5555
# 특정 IP만 허용되어야 함

# 5. systemd 서비스 사용자 확인
grep "User=" /etc/systemd/system/aifarm.service
# User=aifarm
```

---

## 📁 배포 파일 구조

```
deploy/
├── aifarm_setup.sh      # ⭐ 서버 초기 설정 스크립트 (검증된 보안 설정 포함)
│                        #    - 비-root 서비스 사용자 생성
│                        #    - 파일 권한 설정
│                        #    - systemd 보안 강화
├── deploy_to_vultr.bat  # Windows 일괄 배포 스크립트
├── setup_tailscale.sh   # Tailscale VPN 설정 스크립트
├── DEPLOY_GUIDE.md      # 이 문서
└── vultr_setup.sh       # 기존 설정 스크립트 (deprecated - aifarm_setup.sh 사용 권장)
```