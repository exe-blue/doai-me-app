/**
 * 디자인 토큰: 상태별 색/테두리 규정 (Heatmap·KPI 등 공통)
 * 실제 값은 테마(globals.css)에서 정의
 */
export const tokens = {
  device: {
    onlineBg: "var(--green-2)",
    offlineBg: "var(--red-2)",
    offlineBgDim: "var(--gray-2)",
  },
  activity: {
    idleBorder: "var(--gray-5)",
    runningBorder: "var(--blue-6)",
    waitingBorder: "var(--amber-6)",
    errorBorder: "var(--red-7)",
    doneBorder: "var(--gray-6)",
  },
  text: {
    primary: "var(--gray-12)",
    muted: "var(--gray-10)",
  },
} as const;

export type DeviceStatus = "online" | "offline";
export type Activity = "idle" | "running" | "waiting" | "error" | "done";
