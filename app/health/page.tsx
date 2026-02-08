/**
 * Deploy Gate — 프론트가 떠 있으면 무조건 200 (Vercel 확인용)
 */
export default function HealthPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <p className="font-mono text-sm text-muted-foreground">ok</p>
    </main>
  );
}
