# 效卫(效卫投屏) — 벤더 유틸리티 정리

> 에뮬레이터/실기 화면 기기 제어 및 ADB·스크립트(JS 등) 명령을 위한 유틸리티. DoAi.Me 워크플로우에서 **벤더 WS/로컬 도구**로 사용할 수 있는 후보이며, 앞으로 계획 시 참고용으로 정리한다.

---

## 1. 제품 개요

| 항목 | 내용 |
|------|------|
| **명칭** | 效卫投屏 (Xiaowei Touping / 效卫安卓投屏) |
| **제조·운영** | 郑州效卫科技有限公司 (xiaowei.xin / xiaowei.run) |
| **역할** | PC에서 안드로이드 기기 일괄 연결·投屏(미러링)·제어·관리 |
| **대상** | 앱 개발자 테스트, 群控(다기기 동시 제어), 배치 작업 |

- **效卫安卓投屏**: PC용 안드로이드投屏·제어 소프트웨어. USB/WiFi/OTG 등으로 다대다 연결, 1대 PC로 다수 기기 제어.
- **效卫苹果投屏**: iOS용 제어(별도 제품).
- **效卫云手机**: 클라우드 가상 기기 서비스(본 프로젝트와는 별도 채널).

---

## 2. 우리 시스템과의 관계

- **DoAi.Me Node Agent**는 “벤더 WS(예: ws://127.0.0.1:22222)” 또는 로컬 CLI/API를 통해 기기 목록·스크린샷·명령을 내리는 구조이다.
- 效卫安卓投屏은 **에뮬레이터/실기 화면 제어 + ADB·스크립트 명령**을 위한 유틸리티 후보로 본다.
- 실제 연동 시에는 **Minimal Vendor Adapter Contract**(`docs/Minimal-Vendor-Adapter-Contract.md`)를 따르며, 벤더 측에서 제공하는 프로토콜(WebSocket/HTTP/CLI 등)에 맞춰 `action=list`, `action=screen`(savePath) 등을 사용한다.

---

## 3. 공식·참고 링크

| 용도 | URL | 비고 |
|------|-----|------|
| **官网** | https://www.xiaowei.xin/ | 效卫投屏 메인 |
| **帮助中心** | https://www.xiaowei.xin/help | 제품별 매뉴얼 선택 (70=安卓投屏) |
| **安卓投屏手册** | https://www.xiaowei.xin/help/70 | 效卫安卓投屏 도움말 진입점 |
| **文档中心** | https://xiaowei.run/docs/ | 技术文档, 产品手册, 功能演示 등 |
| **技术文档** | https://xiaowei.run/docs/technology/shoujiqunkong/shoujiqunkong001.html | 手机群控 등 기술 문서 |
| **OTG连接** | https://xiaowei.run/docs/news/otg/otg436.html | OTG 연결 관련 |
| **ADB命令** | https://xiaowei.run/docs/news/zhubanji/zhubanji314.html | ADB 명령 관련 |
| **安卓投屏 記事一覧** | https://www.xiaowei.xin/docs/classify/1.html | 安卓手机投屏 분류 문서 목록 |

- 产品手册·功能演示는 飞书(Feishu) 링크로 안내되는 경우 있음 (xiaowei.run/docs 내 링크 참고).

---

## 4. 기능 요약 (문서·검색 기반)

- **연결**: USB, WiFi(adb wireless), OTG. 开发者选项에서 USB 디버깅 활성화 후 사용.
- **投屏**: 기기 화면 실시간 미러링, 4K·60Hz 등 화질 옵션, 息屏 제어(화면 끈 채 제어) 가능.
- **제어**: PC 마우스/키보드로 기기 조작, 多设备连接与群控(다기기 동시 제어).
- **ADB**: adbd 무선 연결, 기기 IP로 WiFi 디버깅. “ADB命令” 문서에서 명령/사용법 확인 필요.
- **스크립트/키맵**: “自定义脚本放入 keymap 目录”, “应用脚本” 등으로 커스텀 키맵·자동화 가능. JS/스크립트 명령은 제품 매뉴얼·技术文档에서 추가 확인 필요.
- **무료 구간**: 40대 이하 무료 등 제한 정책은 공식 사이트·帮助 기준으로 최신 확인 필요.

---

## 5. 앞으로 계획 시 체크 사항

1. **프로토콜 확인**  
   - 效卫安卓投屏이 WebSocket/HTTP/로컬 API를 제공하는지, 포트(예: 22222) 및 메시지 형식 확인.  
   - 우리 쪽은 `action=list`, `action=screen`(savePath) 최소 규약을 전제로 함.

2. **device_id / runtime_handle**  
   - 기기 목록에서 받는 식별자(serial, IP 등)를 `device_id`(onlySerial), `runtime_handle`(ADB/벤더 대상)로 어떻게 매핑할지 결정.

3. **ADB·스크립트**  
   - Preflight(adb devices, unauthorized 감지), Bootstrap(adb shell 설정), 로그인/입력 자동화에 效卫 측 ADB·스크립트 기능을 어떻게 쓸지 문서·실기로 검증.

4. **문서 버전**  
   - xiaowei.xin(帮助 70)과 xiaowei.run(文档)이 혼재하므로, 연동 대상 제품(效卫安卓投屏 등)과 대응하는 최신 문서를 지정해 두는 것이 좋음.

---

## 6. 참조

- **Minimal Vendor Adapter Contract**: `docs/Minimal-Vendor-Adapter-Contract.md`
- **Workflow Recipe DSL v1**: `docs/Prometheus-Workflow-DSL-v1.md`, `docs/Workflow-Recipe-DSL-v1-QA.md`
- **官网**: [效卫投屏 xiaowei.xin](https://www.xiaowei.xin/)  
- **帮助(安卓投屏)**: [https://www.xiaowei.xin/help/70](https://www.xiaowei.xin/help/70)  
- **文档中心**: [xiaowei.run/docs](https://xiaowei.run/docs/)
