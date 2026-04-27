import { useState, useEffect } from 'react';
import { useNavigate }  from 'react-router-dom';
import { useAuth }      from '../contexts/AuthContext';
import { useData }      from '../contexts/DataContext';
import { listenCol }    from '../services/db';
import { LOT_STATUS, LOT_PRIORITY } from '../constants';
import { StatCard, ProgressBar, LotStatusBadge, PriorityBadge } from '../components/ui';
import { gLabel, fmtM, lotProgress } from '../utils';

const ESTADOS_PRODUCCION = [
  'nuevo','recibido_alistamiento','en_corte','entregar_admin',
  'asignacion','costura','listo_remision_tintoreria','tintoreria',
  'listo_bodega','en_operaciones_elrohi','en_revision_calidad','bodega_calidad',
];

export default function Dashboard() {
  const { profile }                         = useAuth();
  const { lots, satellites, supplies }      = useData();
  const navigate                            = useNavigate();
  const [inventario, setInventario]         = useState([]);

  useEffect(() => {
    const unsub = listenCol('inventario', setInventario);
    return unsub;
  }, []);

  // Solo lotes realmente en producción (no en bodega lonas ni despachados)
  const lotsEnProd   = lots.filter(l => ESTADOS_PRODUCCION.includes(l.status));
  const alertSupplies = supplies.filter(s => s.qty <= s.min);
  const alertLots     = lotsEnProd.filter(l => new Date(l.deadline) < new Date());
  const byStatus      = Object.fromEntries(
    ESTADOS_PRODUCCION.map(k => [k, lots.filter(l => l.status === k).length])
  );

  // Inventario stats
  const totalDisponible   = inventario.reduce((a,i) => a+(i.disponible||0), 0);
  const totalAlistamiento = inventario.reduce((a,i) => a+(i.enAlistamiento||0), 0);
  const totalInventario   = totalDisponible + totalAlistamiento;

  return (
    <div>
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Cortes en producción" value={lotsEnProd.length}
          sub={`${lotsEnProd.reduce((a,l)=>a+(l.totalPieces||0),0).toLocaleString('es-CO')} piezas`}
          onClick={() => navigate('/lotes')} />
        <StatCard label="Satélites activos" value={satellites.filter(s=>s.active).length}
          sub={`de ${satellites.length} registrados`}
          onClick={() => navigate('/satelites')} />
        <StatCard label="Alertas insumos" value={alertSupplies.length}
          sub={alertSupplies.length ? 'Requieren atención' : 'Todo OK'}
          onClick={() => navigate('/inventario')} />
        <StatCard label="Pedidos activos" value={0}
          sub="En producción"
          onClick={() => navigate('/pedidos')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* INVENTARIO BODEGA LONAS */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:border-green-200 transition-all"
          onClick={() => navigate('/bodega-lonas')}>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">📦 Inventario Bodega Lonas</h2>

          {inventario.filter(i=>(i.total||0)>0).length === 0 && (
            <div className="flex flex-col items-center justify-center py-6">
              <p className="text-2xl mb-1">📦</p>
              <p className="text-xs text-gray-400">Sin inventario disponible aún</p>
            </div>
          )}

          <div className="space-y-2">
            {inventario.filter(i=>(i.total||0)>0).map(item => (
              <div key={item.gtId} className="px-3 py-2 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-800">{item.descripcionRef||gLabel(item.gtId)}</span>
                  <span className="text-sm font-black text-gray-700">{(item.total||0).toLocaleString('es-CO')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-[10px] text-gray-500">Disponible:</span>
                    <span className="text-[10px] font-black text-green-700">{(item.disponible||0).toLocaleString('es-CO')}</span>
                  </div>
                  {(item.enAlistamiento||0) > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      <span className="text-[10px] text-gray-500">Alistando:</span>
                      <span className="text-[10px] font-black text-blue-700">{(item.enAlistamiento||0).toLocaleString('es-CO')}</span>
                    </div>
                  )}
                </div>
                {(item.total||0) > 0 && (
                  <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-green-500"
                      style={{width:`${Math.round((item.disponible||0)/(item.total||1)*100)}%`}} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalInventario > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
              {[
                ['Total', totalInventario.toLocaleString('es-CO'), '#374151'],
                ['Disponible', totalDisponible.toLocaleString('es-CO'), '#15803d'],
                ['Alistando', totalAlistamiento.toLocaleString('es-CO'), '#2563eb'],
              ].map(([l,v,c]) => (
                <div key={l}>
                  <p className="text-sm font-black" style={{color:c}}>{v}</p>
                  <p className="text-[9px] text-gray-400">{l}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas */}
        <div className="space-y-3">
          {alertSupplies.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <h2 className="text-xs font-bold text-red-600 mb-2">⚠ Insumos bajos ({alertSupplies.length})</h2>
              {alertSupplies.slice(0,5).map(s => (
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
              {alertLots.slice(0,3).map(l => (
                <div key={l.id} className="flex justify-between text-xs py-1 border-b border-amber-50 last:border-0 cursor-pointer hover:text-blue-600"
                  onClick={() => navigate('/lotes')}>
                  <span className="font-mono font-semibold text-blue-700">{l.code}</span>
                  <span className="text-amber-700">{l.deadline}</span>
                </div>
              ))}
            </div>
          )}
          {/* Estado por etapa */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Estado de Producción</h2>
            <div className="space-y-1">
              {ESTADOS_PRODUCCION.filter(k => byStatus[k] > 0).map(k => {
                const meta = LOT_STATUS[k];
                return (
                  <div key={k} className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-700">{meta?.label||k}</span>
                    <span className={`${meta?.cls||'bg-gray-100 text-gray-600'} px-2 py-0.5 rounded-full text-xs font-semibold`}>
                      {byStatus[k]}
                    </span>
                  </div>
                );
              })}
              {ESTADOS_PRODUCCION.every(k => !byStatus[k]) && (
                <p className="text-xs text-gray-400 text-center py-3">Sin cortes en producción</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cortes en producción */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          Lotes en Producción ({lotsEnProd.length})
        </h2>
        {lotsEnProd.length === 0 && (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm text-gray-500">Sin cortes activos en producción</p>
          </div>
        )}
        {lotsEnProd.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {['Código','Prendas','Prioridad','Estado','Progreso','Vence'].map(c=>(
                    <th key={c} className="text-left px-3 py-2 text-gray-400 font-medium border-b border-gray-100">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lotsEnProd.slice(0,8).map(l => {
                  const prog   = lotProgress(l);
                  const gNames = [...new Set((l.garments||[]).map(g=>g.descripcionRef||gLabel(g.gtId)))].slice(0,2).join(', ');
                  const st     = LOT_STATUS[l.status];
                  const vencido = new Date(l.deadline) < new Date();
                  return (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate('/lotes')}>
                      <td className="px-3 py-2 font-mono font-bold text-blue-700">{l.code}</td>
                      <td className="px-3 py-2 text-gray-500">{gNames}</td>
                      <td className="px-3 py-2">
                        <span className={`${LOT_PRIORITY[l.priority]?.cls||'bg-gray-100 text-gray-500'} text-[9px] px-2 py-0.5 rounded-full font-semibold`}>
                          {LOT_PRIORITY[l.priority]?.label||l.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`${st?.cls||'bg-gray-100 text-gray-500'} text-[9px] px-2 py-0.5 rounded-full font-semibold`}>
                          {st?.label||l.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 w-24">
                        {l.lotOps?.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <ProgressBar value={prog} />
                            <span className="text-gray-500 whitespace-nowrap">{prog}%</span>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2" style={{color:vencido?'#dc2626':'#9ca3af'}}>{l.deadline}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
