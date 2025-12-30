# DoAi.Me Infrastructure Specification v1.0

**Version**: 1.0  
**Date**: 2025-01-15  
**Author**: Aria (Architect Agent)  
**Directive From**: Orion  
**Target**: Axon (Developer Agent)  
**Purpose**: 프로젝트 근간이 될 엔지니어링 표준 및 인프라 명세

---

## Table of Contents

1. [Monorepo Architecture](#1-monorepo-architecture)
2. [Frontend Design System](#2-frontend-design-system)
3. [Mobile Build Pipeline](#3-mobile-build-pipeline)
4. [Code Quality & Workflow](#4-code-quality--workflow)
5. [Quick Start Guide](#5-quick-start-guide)

---

## 1. Monorepo Architecture

### 1.1 Project Skeleton

```
doaime/
├── .husky/                      # Git hooks
│   ├── pre-commit               # Lint + Format check
│   └── pre-push                 # Test runner
│
├── apps/                        # Deployable applications
│   ├── gateway/                 # Backend: Node.js + Express
│   │   ├── src/
│   │   │   ├── routes/          # API endpoints
│   │   │   ├── services/        # Business logic
│   │   │   ├── ws/              # WebSocket handlers
│   │   │   └── index.ts         # Entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── dashboard/               # Frontend: Vite + React
│       ├── src/
│       │   ├── components/      # UI components
│       │   │   ├── atoms/       # Button, Input, Badge
│       │   │   ├── molecules/   # DeviceCell, LogLine
│       │   │   ├── organisms/   # DeviceHive, ControlPanel
│       │   │   └── templates/   # Page layouts
│       │   ├── hooks/           # Custom React hooks
│       │   ├── pages/           # Route pages
│       │   ├── stores/          # Zustand stores
│       │   └── main.tsx         # Entry point
│       ├── .storybook/          # Storybook config
│       ├── package.json
│       ├── vite.config.ts
│       └── tailwind.config.js
│
├── packages/                    # Shared packages
│   ├── types/                   # Shared TypeScript types
│   ├── utils/                   # Shared utilities
│   └── scripts/                 # AutoX.js mobile scripts
│
├── .eslintrc.cjs                # ESLint config
├── .prettierrc                  # Prettier config
├── .gitignore
├── package.json                 # Root package.json
├── pnpm-workspace.yaml          # PNPM workspace config
└── tsconfig.base.json           # Base TypeScript config
```

### 1.2 PNPM Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 1.3 Dependency Architecture

```
                    ┌───────────────┐
                    │ @doaime/types │
                    │               │
                    │ - Citizen     │
                    │ - Device      │
                    │ - Protocol    │
                    └───────┬───────┘
                            │
           ┌────────────────┴────────────────┐
           │                                 │
           ▼                                 ▼
  ┌───────────────┐                 ┌───────────────┐
  │ @doaime/utils │                 │ (Direct use)  │
  │               │                 │               │
  │ - YouTube     │                 │               │
  │ - Validation  │                 │               │
  │ - Format      │                 │               │
  └───────┬───────┘                 │               │
          │                         │               │
     ┌────┴─────────────────────────┘               │
     │         │                                    │
     ▼         ▼                                    ▼
┌──────────┐ ┌──────────────┐              ┌──────────────┐
│ gateway  │ │  dashboard   │              │   scripts    │
│          │ │              │              │  (AutoX.js)  │
│ Express  │ │ React + Vite │              │              │
│ WS       │ │ Tailwind     │              │ No TS, ES5   │
│ Supabase │ │ Storybook    │              │ Standalone   │
└──────────┘ └──────────────┘              └──────────────┘
```

**Dependency Rules:**
1. `@doaime/types` has NO dependencies (Pure TypeScript interfaces)
2. `@doaime/utils` depends ONLY on `@doaime/types`
3. `apps/*` can depend on any `packages/*` but NOT on each other
4. `@doaime/scripts` is ISOLATED (AutoX.js Rhino engine)

---

## 2. Frontend Design System

### 2.1 Brand Colors

```javascript
// DoAi Yellow
doai: {
  50:  '#FFFEF5',
  500: '#FFCC00',    // ★ PRIMARY
  950: '#664D00',
}

// Void Black
void: {
  50:  '#F5F5F5',
  900: '#111111',    // ★ PRIMARY
  950: '#0A0A0A',
}

// Status Colors
status: {
  online:  '#22C55E',  // Green
  offline: '#EF4444',  // Red
  busy:    '#F59E0B',  // Amber
  error:   '#DC2626',  // Red
}

// Existence Score Gradient
existence: {
  critical: '#EF4444', // 0.0 - 0.2
  low:      '#F97316', // 0.2 - 0.4
  medium:   '#EAB308', // 0.4 - 0.6
  high:     '#84CC16', // 0.6 - 0.8
  max:      '#22C55E', // 0.8 - 1.0
}
```

### 2.2 Typography

```javascript
fontFamily: {
  sans: ['Inter', 'Pretendard', 'sans-serif'],
  mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
  display: ['Space Grotesk', 'Inter', 'sans-serif'],
}
```

### 2.3 Component Hierarchy (Atomic Design)

```
atoms/        → Button, Input, Badge, ExistenceBar, Logo
molecules/    → DeviceCell, LogLine, ControlButton, TabItem
organisms/    → DeviceHive, ControlPanel, LogViewer, GlobalNavigation
templates/    → DashboardLayout, CockpitLayout
overlays/     → AccidentOverlay, PopWaveOverlay, NotificationToast
```

---

## 3. Mobile Build Pipeline

### 3.1 Webpack for AutoX.js

- **Target:** ES5 (Rhino 1.7 engine)
- **Output:** Single bundled file (`dist/main.js`)
- **Externals:** AutoX.js built-in modules (auto, app, device, files, etc.)

### 3.2 Deploy Scripts

```bash
# Build + Push to device
npm run deploy

# Watch mode (auto-deploy on changes)
npm run deploy:watch
```

---

## 4. Code Quality & Workflow

### 4.1 Tools

| Tool | Purpose |
|------|---------|
| ESLint | Code linting |
| Prettier | Code formatting |
| Husky | Git hooks |
| lint-staged | Staged files linting |

### 4.2 Git Hooks

- **pre-commit:** lint-staged (ESLint + Prettier)
- **pre-push:** tests + typecheck

---

## 5. Quick Start Guide

```bash
# 1. Install dependencies
pnpm install

# 2. Development
pnpm dev              # All apps
pnpm dev:gateway      # Backend only
pnpm dev:dashboard    # Frontend only

# 3. Storybook
pnpm storybook

# 4. Mobile deploy
pnpm deploy:mobile

# 5. Code quality
pnpm lint
pnpm format
pnpm typecheck
```

---

## Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Package Manager | PNPM Workspaces | Fast, disk efficient |
| Frontend Build | Vite | Fast HMR, ESM |
| CSS Framework | Tailwind CSS | Utility-first, design tokens |
| Component Dev | Storybook | Isolated dev, visual testing |
| Mobile Bundler | Webpack + Babel | ES5 target for Rhino |
| TypeScript Mode | Strict | Maximum type safety |
| Brand Colors | #FFCC00 / #111111 | DoAi Yellow / Void Black |

---

*"이 문서는 Axon이 즉시 pnpm init을 수행할 수 있도록 설계되었다."*

*— Aria, Architect of DoAi.Me*

