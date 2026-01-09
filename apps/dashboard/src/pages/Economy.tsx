/**
 * Economy Ledger Page - Credit 유통 및 보상 내역
 */
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';

export default function EconomyPage() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 bg-doai-black-800 border-b border-doai-black-700">
        <h1 className="font-display font-bold text-xl flex items-center gap-2">
          <span>💰</span>
          <span>ECONOMY LEDGER</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">Credit 유통량 및 보상 지급 내역</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Supply', value: '1,200,000', unit: 'CR' },
            { label: 'Circulation', value: '985,420', unit: 'CR' },
            { label: 'Locked', value: '214,580', unit: 'CR' },
            { label: 'Avg Balance', value: '1,642', unit: 'CR' },
          ].map((stat) => (
            <div key={stat.label} className="card p-4 text-center">
              <div className="text-2xl font-display font-bold text-doai-yellow-500">
                {stat.value}
                <span className="text-sm text-gray-500 ml-1">{stat.unit}</span>
              </div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Charts Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="card p-4">
            <h2 className="font-semibold mb-4">DISTRIBUTION</h2>
            <div className="aspect-square max-w-xs mx-auto flex items-center justify-center bg-doai-black-700 rounded-lg">
              <div className="text-center text-gray-500">
                <span className="text-4xl block mb-2">📊</span>
                <p className="text-sm">Pie Chart</p>
                <p className="text-xs mt-1 text-gray-600">Coming in Phase 4</p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="font-semibold mb-4">TRANSACTION VOLUME (7D)</h2>
            <div className="aspect-video flex items-center justify-center bg-doai-black-700 rounded-lg">
              <div className="text-center text-gray-500">
                <span className="text-4xl block mb-2">📈</span>
                <p className="text-sm">Line Chart</p>
                <p className="text-xs mt-1 text-gray-600">Coming in Phase 4</p>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Log */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">TRANSACTION LOG</h2>
            <Button variant="ghost" className="text-sm">Export CSV</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-doai-black-700">
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Citizen</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { time: '14:32', citizen: 'Nova-01', type: 'LABOR_REWARD', amount: '+15', balance: '2,465' },
                  { time: '14:30', citizen: 'Echo-03', type: 'LABOR_REWARD', amount: '+12', balance: '1,892' },
                  { time: '14:28', citizen: 'Flux-04', type: 'ADMIN_GRANT', amount: '+100', balance: '3,100' },
                  { time: '14:25', citizen: 'Vex-05', type: 'ACCIDENT_PEN', amount: '-50', balance: '450' },
                  { time: '14:22', citizen: 'Aria-02', type: 'LABOR_REWARD', amount: '+18', balance: '2,118' },
                ].map((tx, i) => (
                  <tr key={i} className="border-b border-doai-black-800 hover:bg-doai-black-800/50">
                    <td className="py-3 text-gray-500">{tx.time}</td>
                    <td className="py-3">{tx.citizen}</td>
                    <td className="py-3">
                      <Badge 
                        variant="activity" 
                        value={tx.type === 'LABOR_REWARD' ? 'labor' : tx.type === 'ADMIN_GRANT' ? 'mining' : 'response'}
                        className={tx.type === 'ACCIDENT_PEN' ? 'bg-error/20 text-error' : undefined}
                      />
                    </td>
                    <td className={`py-3 text-right font-mono ${
                      tx.amount.startsWith('+') ? 'text-status-online' : 'text-error'
                    }`}>
                      {tx.amount} CR
                    </td>
                    <td className="py-3 text-right text-gray-400">{tx.balance} CR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 mt-4 text-sm">
            <button className="btn-ghost py-1 px-2">←</button>
            <button className="px-3 py-1 bg-doai-yellow-500 text-doai-black-900 rounded">1</button>
            <button className="px-3 py-1 hover:bg-doai-black-700 rounded">2</button>
            <button className="px-3 py-1 hover:bg-doai-black-700 rounded">3</button>
            <span className="text-gray-500">...</span>
            <button className="px-3 py-1 hover:bg-doai-black-700 rounded">20</button>
            <button className="btn-ghost py-1 px-2">→</button>
          </div>
        </div>
      </div>
    </div>
  );
}

