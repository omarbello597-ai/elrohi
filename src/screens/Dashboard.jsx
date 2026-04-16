import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../contexts/AuthContext';
import { useData }     from '../contexts/DataContext';
import { LOT_STATUS, LOT_PRIORITY } from '../constants';
import { StatCard, ProgressBar, LotStatusBadge, PriorityBadge } from '../components/ui';
import { gLabel, cLabel, fmtM, lotProgress } from '../utils';

export default function Dashboard() {
  const { profile }                     = useAuth();
  const { lots, orders, satellites, supplies, clients } = useData();
  const navigate                        = useNavigate();

  const activeLots    = lots.filter((l) => !['despachado'].includes(l.status));
  const alertSupplies = supplies.filter((s) => s.qty <= s.min);
  const alertLots     = activeLots.filter((l) => new Date(l.deadline) < new Date());
  const byStatus      = Object.fromEntries(Object.keys(LOT_STATUS).map((k) => [k, lots.filter((l) => l.status === k).length]));

  return (
    <div>
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Lotes activos"      value={activeLots.length}                     sub={`${activeLots.reduce((a, l) => a + l.totalPieces, 0).toLocaleString('es-CO')} piezas`} onClick={() => navigate('/lotes')} />
        <StatCard label="Satélites activos"  value={satellites.filter((s) => s.active).length} sub={`de ${satellites.length} registrados`} onClick={() => navigate('/satelites')} />
        <StatCard label="Alertas insumos"    value={alertSupplies.length}                  sub={alertSupplies.length ? 'Requieren atención' : 'Todo OK'} onClick={() => navigate('/inventario')} />
        <StatCard label="Pedidos activos"    value={orders.filter((o) => o.status === 'en_produccion').length} sub="En producción" onClick={() => navigate('/pedidos')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Estado de producción */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Estado de Producción</h2>
          <div className="space-y-1.5">
            {Object.entries(LOT_STATUS)
              .filter(([k]) => byStatus[k] > 0)
              .map(([k, meta]) => (
                <div key={k} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-700">{meta.label}</span>
                  <span className={`${meta.cls} px-2 py-0.5 rounded-full text-xs font-semibold`}>{byStatus[k]}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Alertas */}
        <div className="space-y-3">
          {alertSupplies.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <h2 className="text-xs font-bold text-red-600 mb-2">⚠ Insumos bajos ({alertSupplies.length})</h2>
              {alertSupplies.slice(0, 5).map((s) => (
                <div key={s.id} className="flex justify-between text-xs py-1 border-b border-red-50 last:border-0">
                  <span className="text-gray-700">{s.name}</span>
                  <span className="text-red-600 font-semibold">{s.qty}/{s.min} {s.unit}</span>
                </div>
              ))}
            </div>
          )}

          {alertLots.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 p-4">
              <h2 className="text-xs font-bold text-amber-700 mb-2">⏰ Lotes vencidos ({alertLots.length})</h2>
              {alertLots.slice(0, 3).map((l) => (
                <div key={l.id} className="flex justify-between text-xs py-1 border-b border-amber-50 last:border-0 cursor-pointer hover:text-blue-600" onClick={() => navigate('/lotes')}>
                  <span className="font-mono font-semibold text-blue-700">{l.code}</span>
                  <span className="text-amber-700">{l.deadline}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lots table */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Lotes en Producción</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {['Código', 'Cliente', 'Prendas', 'Prioridad', 'Estado', 'Progreso', 'Vence'].map((c) => (
                  <th key={c} className="text-left px-3 py-2 text-gray-400 font-medium border-b border-gray-100">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeLots.slice(0, 8).map((l) => {
                const prog    = lotProgress(l);
                const gNames  = [...new Set(l.garments.map((g) => gLabel(g.gtId)))].slice(0, 2).join(', ');
                return (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/lotes')}>
                    <td className="px-3 py-2 font-mono font-bold text-blue-700">{l.code}</td>
                    <td className="px-3 py-2 text-gray-700 font-medium">{cLabel(clients, l.clientId)}</td>
                    <td className="px-3 py-2 text-gray-500">{gNames}</td>
                    <td className="px-3 py-2"><PriorityBadge priority={l.priority} /></td>
                    <td className="px-3 py-2"><LotStatusBadge status={l.status} /></td>
                    <td className="px-3 py-2 w-24">
                      {l.lotOps?.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <ProgressBar value={prog} />
                          <span className="text-gray-500 whitespace-nowrap">{prog}%</span>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-400">{l.deadline}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
