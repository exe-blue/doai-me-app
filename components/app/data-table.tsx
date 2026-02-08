"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface DataTableProps {
  children: React.ReactNode
  className?: string
}

/**
 * 표 스타일 통일. Table 래퍼 + 카드/간격 규약.
 * 새 테이블은 이 컴포넌트로 (MVP 규칙).
 */
export function DataTable({ children, className }: DataTableProps) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border", className)}>
      <Table>{children}</Table>
    </div>
  )
}

export { TableBody, TableCell, TableHead, TableHeader, TableRow }
