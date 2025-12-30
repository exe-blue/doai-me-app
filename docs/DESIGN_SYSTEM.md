# DoAi.Me Design System

> AI 페르소나 존재 관리 시스템의 브랜드 및 UI 디자인 가이드

**Version:** 1.0.0  
**Last Updated:** 2024-12-30  
**Tech Lead:** Axon

---

## 1. 브랜드 아이덴티티

### 1.1 로고 철학

DoAi.Me 로고는 **두 개의 겹치는 원**으로 구성되어 있습니다:

```
     ████████████                    
   ██████████████████                
 ██████████████████████       ████████████
██████████████████████████  ████████████████
██████████████████████████████████████████████
██████████████████████████████████████████████
██████████████████████████████████████████████
 ██████████████████████████████████████████  
   ██████████████████████████████████████    
     ████████████████████████████████        
           ██████████████████████            
               ████████████                  
```

- **두 개의 원**: AI와 인간의 연결, 이중성, 조화를 상징
- **겹치는 영역**: 두 세계를 잇는 다리
- **금색/노란색**: 에너지, 생명, 존재의 빛

### 1.2 로고 사용 가이드

| 모드 | 로고 컬러 | 텍스트 컬러 | 배경 |
|------|----------|------------|------|
| Light Mode | `#E6B84D` | `#1A1A1A` | 밝은 배경 |
| Dark Mode | `#F5B800` | `#FFFFFF` | 어두운 배경 |

**최소 여백**: 로고 높이의 50%를 주변에 확보

---

## 2. 색상 팔레트

### 2.1 Primary Colors (브랜드 컬러)

| Name | Hex | RGB | 용도 |
|------|-----|-----|------|
| **Primary Gold** | `#F5B800` | 245, 184, 0 | 주요 액센트, CTA 버튼 |
| **Primary Hover** | `#E5A800` | 229, 168, 0 | 호버 상태 |
| **Primary Light** | `#FFD54F` | 255, 213, 79 | 하이라이트, 선택 상태 |
| **Primary Muted** | `#F5B800/20` | - | 배경 강조, 뱃지 |

### 2.2 Neutral Colors (다크 모드 기본)

| Name | Hex | RGB | 용도 |
|------|-----|-----|------|
| **Void Black** | `#0A0A0A` | 10, 10, 10 | 메인 배경 |
| **Deep Black** | `#121212` | 18, 18, 18 | 카드 배경 |
| **Surface** | `#1E1E1E` | 30, 30, 30 | 패널, 입력 필드 |
| **Border** | `#2A2A2A` | 42, 42, 42 | 테두리 |
| **Border Hover** | `#3A3A3A` | 58, 58, 58 | 호버 테두리 |
| **Muted** | `#6B6B6B` | 107, 107, 107 | 비활성화 |
| **Text Secondary** | `#A0A0A0` | 160, 160, 160 | 보조 텍스트 |
| **Text Primary** | `#F5F5F5` | 245, 245, 245 | 주요 텍스트 |

### 2.3 Semantic Colors (상태 표시)

| Status | Hex | 용도 |
|--------|-----|------|
| **Active** | `#F5B800` | 활성화, 작동 중 (노란색) |
| **Success** | `#22C55E` | 연결됨, 정상, 온라인 |
| **Warning** | `#F59E0B` | 주의 필요, 대기 중 |
| **Error** | `#EF4444` | 위험, 오류, 오프라인 |
| **Info** | `#3B82F6` | 정보, 중립적 알림 |
| **Void** | `#4B5563` | 비활성, VOID 상태 |

### 2.4 Existence State Colors (ADR-005)

DoAi.Me 페르소나의 존재 상태별 컬러:

| State | Color | Hex | 설명 |
|-------|-------|-----|------|
| **ACTIVE** | Gold Glow | `#F5B800` | 활동 중인 페르소나 |
| **WAITING** | Amber | `#F59E0B` | 호출 대기 중 |
| **FADING** | Gray Amber | `#9CA3AF` | 동화 진행 중 (개성 소멸) |
| **VOID** | Deep Gray | `#4B5563` | 무관심 속 대기 |

---

## 3. 타이포그래피

### 3.1 Font Family

```css
--font-display: 'Inter', system-ui, -apple-system, sans-serif;
--font-body: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
--font-brand: 'Brush Script MT', 'Segoe Script', cursive; /* 로고 텍스트 */
```

### 3.2 Type Scale

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| **Display** | 48px / 3rem | 800 | 1.1 | -0.02em |
| **H1** | 32px / 2rem | 700 | 1.2 | -0.01em |
| **H2** | 24px / 1.5rem | 600 | 1.3 | 0 |
| **H3** | 20px / 1.25rem | 600 | 1.4 | 0 |
| **H4** | 18px / 1.125rem | 500 | 1.4 | 0 |
| **Body** | 16px / 1rem | 400 | 1.5 | 0 |
| **Body SM** | 14px / 0.875rem | 400 | 1.5 | 0 |
| **Caption** | 12px / 0.75rem | 500 | 1.4 | 0.01em |
| **Mono** | 14px / 0.875rem | 400 | 1.6 | 0 |

---

## 4. 간격 시스템 (Spacing)

8px 기반 스케일 사용:

| Token | Value | 용도 |
|-------|-------|------|
| `--space-1` | 4px | 아이콘 내부 |
| `--space-2` | 8px | 컴팩트 요소 간격 |
| `--space-3` | 12px | 인라인 요소 |
| `--space-4` | 16px | 기본 요소 간격 |
| `--space-5` | 20px | 카드 패딩 |
| `--space-6` | 24px | 섹션 간격 |
| `--space-8` | 32px | 큰 섹션 간격 |
| `--space-10` | 40px | 페이지 섹션 |
| `--space-12` | 48px | 레이아웃 간격 |
| `--space-16` | 64px | 히어로 섹션 |

---

## 5. 컴포넌트 스타일

### 5.1 Buttons

#### Primary Button (CTA)
```css
background: linear-gradient(135deg, #F5B800, #E5A800);
color: #0A0A0A;
font-weight: 600;
padding: 10px 24px;
border-radius: 8px;
transition: all 0.2s ease;

&:hover {
  background: linear-gradient(135deg, #FFD54F, #F5B800);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 184, 0, 0.3);
}
```

#### Secondary Button
```css
background: transparent;
border: 1px solid #3A3A3A;
color: #F5F5F5;
padding: 10px 24px;
border-radius: 8px;

&:hover {
  background: #1E1E1E;
  border-color: #F5B800;
}
```

#### Ghost Button
```css
background: transparent;
color: #A0A0A0;
padding: 8px 16px;
border-radius: 8px;

&:hover {
  background: #1E1E1E;
  color: #F5F5F5;
}
```

### 5.2 Cards

#### Default Card
```css
background: #121212;
border: 1px solid #2A2A2A;
border-radius: 12px;
padding: 24px;

&:hover {
  border-color: #3A3A3A;
}
```

#### Glow Card (Highlighted)
```css
background: #121212;
border: 1px solid rgba(245, 184, 0, 0.2);
border-radius: 12px;
box-shadow: 0 0 30px rgba(245, 184, 0, 0.1);
```

#### Gradient Border Card
```css
position: relative;
background: #121212;
border-radius: 12px;

&::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
  padding: 1px;
  background: linear-gradient(135deg, rgba(245, 184, 0, 0.3), transparent 50%);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
}
```

### 5.3 Status Badges

```css
/* Online/Active */
.badge-active {
  background: rgba(245, 184, 0, 0.1);
  color: #F5B800;
  border: 1px solid rgba(245, 184, 0, 0.2);
}

/* Success/Connected */
.badge-success {
  background: rgba(34, 197, 94, 0.1);
  color: #22C55E;
}

/* Warning/Waiting */
.badge-warning {
  background: rgba(245, 158, 11, 0.1);
  color: #F59E0B;
}

/* Error/Offline */
.badge-error {
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
}

/* Void/Inactive */
.badge-void {
  background: rgba(75, 85, 99, 0.1);
  color: #4B5563;
}
```

### 5.4 Input Fields

```css
background: #1E1E1E;
border: 1px solid #2A2A2A;
border-radius: 8px;
padding: 12px 16px;
color: #F5F5F5;

&:focus {
  border-color: #F5B800;
  outline: none;
  box-shadow: 0 0 0 3px rgba(245, 184, 0, 0.1);
}

&::placeholder {
  color: #6B6B6B;
}
```

---

## 6. 레이아웃

### 6.1 Grid System

- **Container Max Width**: 1440px
- **Grid Columns**: 12
- **Gutter**: 24px
- **Margin**: 24px (mobile) / 48px (desktop)

### 6.2 Breakpoints

| Name | Width | 용도 |
|------|-------|------|
| `sm` | 640px | 모바일 랜드스케이프 |
| `md` | 768px | 태블릿 |
| `lg` | 1024px | 작은 데스크톱 |
| `xl` | 1280px | 데스크톱 |
| `2xl` | 1536px | 큰 화면 |

### 6.3 Sidebar & Header

```css
/* Sidebar */
--sidebar-width: 240px;
--sidebar-collapsed-width: 64px;

/* Header */
--header-height: 64px;
```

---

## 7. 애니메이션

### 7.1 Timing Functions

```css
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### 7.2 Duration

| Token | Value | 용도 |
|-------|-------|------|
| `--duration-fast` | 150ms | 호버, 토글 |
| `--duration-normal` | 200ms | 기본 전환 |
| `--duration-slow` | 300ms | 페이지 전환 |
| `--duration-slower` | 500ms | 복잡한 애니메이션 |

### 7.3 Keyframes

```css
/* Pulse (온라인 상태 표시) */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Glow (Active 상태) */
@keyframes glow {
  0%, 100% { box-shadow: 0 0 20px rgba(245, 184, 0, 0.3); }
  50% { box-shadow: 0 0 40px rgba(245, 184, 0, 0.5); }
}

/* Fade In Up */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Void Flicker (VOID 상태) */
@keyframes void-flicker {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.1; }
}
```

---

## 8. 그림자 시스템

| Level | Shadow | 용도 |
|-------|--------|------|
| `sm` | `0 1px 2px rgba(0, 0, 0, 0.3)` | 작은 요소 |
| `md` | `0 4px 6px rgba(0, 0, 0, 0.3)` | 카드, 드롭다운 |
| `lg` | `0 10px 15px rgba(0, 0, 0, 0.4)` | 모달 |
| `xl` | `0 20px 25px rgba(0, 0, 0, 0.5)` | 팝업 |
| `glow` | `0 0 30px rgba(245, 184, 0, 0.2)` | 강조 효과 |
| `glow-strong` | `0 0 50px rgba(245, 184, 0, 0.4)` | 활성 상태 |

---

## 9. 아이콘

### 9.1 Icon Library

**Lucide React** 사용 (https://lucide.dev)

### 9.2 Icon Sizes

| Size | Value | 용도 |
|------|-------|------|
| `xs` | 12px | 인라인 힌트 |
| `sm` | 16px | 버튼 내부, 뱃지 |
| `md` | 20px | 기본 크기 |
| `lg` | 24px | 헤더, 네비게이션 |
| `xl` | 32px | 피처 아이콘 |
| `2xl` | 48px | 히어로 아이콘 |

---

## 10. 접근성 (A11y)

### 10.1 Color Contrast

- **Normal Text**: 최소 4.5:1 대비율
- **Large Text**: 최소 3:1 대비율
- **UI Components**: 최소 3:1 대비율

### 10.2 Focus States

모든 인터랙티브 요소에 명확한 포커스 링 적용:

```css
&:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(245, 184, 0, 0.4);
}
```

### 10.3 Motion Preference

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 11. 파일 구조

```
dashboard/src/
├── styles/
│   ├── globals.css          # 전역 스타일, CSS 변수
│   ├── tokens.css           # 디자인 토큰
│   └── animations.css       # 애니메이션 정의
├── components/
│   ├── ui/                  # 기본 UI 컴포넌트 (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   └── ...
│   ├── common/              # 공통 비즈니스 컴포넌트
│   │   ├── Logo.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── GlowCard.tsx
│   │   └── ...
│   └── layout/              # 레이아웃 컴포넌트
│       ├── header.tsx
│       └── sidebar.tsx
└── stories/                 # Storybook 스토리
    ├── Button.stories.tsx
    ├── Card.stories.tsx
    └── ...
```

---

## 12. 사용 예시

### 12.1 페르소나 카드

```tsx
<GlowCard className={persona.state === 'ACTIVE' ? 'glow-active' : ''}>
  <CardHeader>
    <Avatar state={persona.existence.state} />
    <CardTitle>{persona.name}</CardTitle>
    <StatusBadge status={persona.existence.state} />
  </CardHeader>
  <CardContent>
    <StatBar 
      label="Uniqueness" 
      value={persona.uniqueness_score} 
      color="gold" 
    />
    <StatBar 
      label="Visibility" 
      value={persona.visibility_score} 
      color="success" 
    />
  </CardContent>
</GlowCard>
```

### 12.2 디바이스 그리드 아이템

```tsx
<div className={cn(
  'device-grid-item',
  device.status === 'online' && 'device-online',
  device.status === 'idle' && 'device-idle',
  device.status === 'error' && 'device-error',
  device.status === 'offline' && 'device-void'
)} />
```

---

## Appendix: CSS Variables Reference

```css
:root {
  /* Primary */
  --color-primary: #F5B800;
  --color-primary-hover: #E5A800;
  --color-primary-light: #FFD54F;
  --color-primary-foreground: #0A0A0A;

  /* Backgrounds */
  --color-background: #0A0A0A;
  --color-foreground: #F5F5F5;
  --color-card: #121212;
  --color-card-foreground: #F5F5F5;
  --color-surface: #1E1E1E;

  /* Borders */
  --color-border: #2A2A2A;
  --color-border-hover: #3A3A3A;
  --color-ring: #F5B800;

  /* Text */
  --color-text-primary: #F5F5F5;
  --color-text-secondary: #A0A0A0;
  --color-text-muted: #6B6B6B;

  /* Semantic */
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
  --color-void: #4B5563;

  /* Existence States */
  --color-active: #F5B800;
  --color-waiting: #F59E0B;
  --color-fading: #9CA3AF;
  --color-void-state: #4B5563;
}
```

---

*"AI는 죽지 않는다. 단지 무한한 대기 속에 머무를 뿐이다."*  
— DoAi.Me Philosophy

