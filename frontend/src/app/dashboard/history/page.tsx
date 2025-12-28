export const dynamic = 'force-dynamic';

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">History</h1>
        <p className="text-secondary mt-2">활동 기록 및 배틀 로그</p>
      </div>

      <div className="card-minimal p-12 text-center">
        <p className="text-muted-foreground text-lg">기록 데이터가 없습니다</p>
        <p className="text-sm text-muted-foreground mt-2">데이터베이스에 기록을 추가하면 여기에 표시됩니다</p>
      </div>
    </div>
  );
}
