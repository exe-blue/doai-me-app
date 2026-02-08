"use client"

/**
 * 히트맵(Online/Offline, Running/Error/Done). device-heatmap 재export + 상태 색상 규약 적용.
 * 새 히트맵 필요 시 이 컴포넌트 또는 DeviceHeatmap 사용 (MVP 규칙).
 */
export { DeviceHeatmap } from "@/components/dashboard/device-heatmap"
export type { DeviceTileData, DeviceTileStatus } from "@/components/dashboard/device-heatmap"
