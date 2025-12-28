export const dynamic = 'force-dynamic';

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Agents</h1>
        <p className="text-secondary mt-2">AI 에이전트 관리 및 모니터링</p>
      </div>

      <div className="card-minimal p-12 text-center">
        <p className="text-muted-foreground text-lg">에이전트 데이터가 없습니다</p>
        <p className="text-sm text-muted-foreground mt-2">데이터베이스에 에이전트를 추가하면 여기에 표시됩니다</p>
      </div>
    </div>
  );
}
