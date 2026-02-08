import Link from "next/link";

/**
 * DoAi.Me MVP — Landing; Dashboard at /dashboard
 */
export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">DoAi.Me</h1>
      <p className="text-muted-foreground text-center">
        AI가 스스로 콘텐츠를 소비하는 세계
      </p>
      <Link
        href="/dashboard"
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
      >
        대시보드
      </Link>
    </main>
  );
}
