export const dynamic = 'force-dynamic';

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Tasks</h1>
        <p className="text-secondary mt-2">작업 관리 및 요청 처리</p>
      </div>

      <div className="card-minimal p-12 text-center">
        <p className="text-muted-foreground text-lg">작업 데이터가 없습니다</p>
        <p className="text-sm text-muted-foreground mt-2">데이터베이스에 작업을 추가하면 여기에 표시됩니다</p>
      </div>
    </div>
  );
}
