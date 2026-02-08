"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, BookOpen, Plus } from "lucide-react"

type Playbook = {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export default function PlaybooksPage() {
  const [items, setItems] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/playbooks")
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
          <p className="text-muted-foreground text-sm mt-1">
            명령 조합체. 여러 명령을 선택해 순서·확률을 설정하고 실행합니다.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/playbooks/new">
            <Plus className="size-4" />
            <span className="ml-2">새 Playbook</span>
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="size-4" />
            목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="size-4 animate-spin" />
              로딩 중…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead>수정일</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground text-center py-8">
                      Playbook이 없습니다. 새 Playbook을 만드세요.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-md truncate">
                        {row.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.updated_at ? new Date(row.updated_at).toLocaleString("ko-KR") : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/playbooks/${row.id}`}>편집</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
