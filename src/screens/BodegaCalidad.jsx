import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { updateDocument } from '../services/db';
import { advanceLotStatus } from '../services/db_timeline';
import { gLabel, fmtM } from '../utils';
import { ACCENT } from '../constants';
import toast from 'react-hot-toast';

export default function BodegaCalidadScreen() {
  const { profile } = useAuth();
  const { lots, users } = useData();
  const [selLot, setSelLot] = useState(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);
  const isOp    = ['bodega_op','terminacion','operario'].includes(profile?.role) || isAdmin;

  // Lotes en operaciones internas o en revisión de calidad
  const enOps      = lots.filter(l => l.status === 'en_operaciones_elrohi');
  const enRevision = lots.filter(l => l.status === 'en_revision_calidad');

  const completarOp = async (lot, opId) => {
    const opsElrohi = (lot.opsElrohi || []).map(op =>
      op.id === opId ? { ...op, status: 'completado', doneAt: new Date().toISOString() } : op
    );
    const allDone = opsElrohi.every(op => op.status === 'completado');
    try {
      if (allDone) {
        await advanceLotStatus(lot.id, 'en_revision_calidad', profile?.id, profile?.name, { opsElrohi });
        toast.success('✅ Operaciones completas — lote en revisión de calidad');
      } else {
        await updateDocument('lots', lot.id, { opsElrohi });
        toast.success('Operación marcada como completada');
      }
    } catch { toast.error('Error'); }
  };

  const aprobarCalidad = async (lot) => {
    setSaving(true);
    try {
      await advanceLotStatus(lot.id, 'bodega_lonas', profile?.id, profile?.name, {
        aprobadoCalidadPor: profile?.name,
        aprobadoCalidadAt: new Date().toISOString(),
      });
      toast.success('✅ Aprobado — lote pasa a Bodega Lonas');
      setSelLot(null);
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  const rechazarCalidad = async (lot, motivo) => {
    setSaving(true);
    try {
      await advanceLotStatus(lot.id, 'en_operaciones_elrohi', profile?.id, profile?.name, {
        rechazoCalidad: { motivo, por: profile?.name, at: new Date().toISOString() },
      });
      toast.success('Lote devuelto a operaciones');
      setSelLot(null);
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-2">Bodega Control de Calidad</h1>
      <p className="text-xs text-gray-500 mb-4">Operaciones internas y revisión de calidad antes de pasar a Bodega Lonas</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          ['ops',      `En Operaciones (${enOps.length})`],
          ['revision', `En Revisión (${enRevision.length})`],
        ].map(([k,l]) => (
          <button key={k} onClick={() => setSelLot(k === selLot?.tab ? null : { tab: k })}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{ background: selLot?.tab===k||(!selLot&&k==='ops')?'#fff':'transparent', color:'#111827', fontWeight:700 }}>
            {l}
          </button>
        ))}
      </div>

      {/* EN OPERACIONES INTERNAS */}
      <div className="space-y-3 mb-6">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">En Operaciones Internas ({enOps.length})</p>
        {enOps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-100">
            <p className="text-3xl mb-2">⚡</p>
            <p className="font-medium text-gray-700 text-sm">Sin lotes en operaciones</p>
          </div>
        )}
        {enOps.map(lot => {
          const ops  = lot.opsElrohi || [];
          const done = ops.filter(o => o.status === 'completado').length;
          const prog = ops.length > 0 ? Math.round(done/ops.length*100) : 0;
          return (
            <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                    <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">⚡ Operaciones ELROHI</span>
                    {lot.esParcial && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Parcial</span>}
                  </div>
                  <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-black" style={{color:prog===100?'#15803d':'#e85d26'}}>{prog}%</p>
                  <p className="text-[9px] text-gray-400">{done}/{ops.length} ops</p>
                </div>
              </div>

              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div className="h-full rounded-full transition-all" style={{width:`${prog}%`,background:prog===100?'#10b981':ACCENT}} />
              </div>

              {/* Lista de operaciones con operario y botón completar */}
              {ops.length > 0 && (
                <div className="space-y-1.5">
                  {ops.map((op,i) => {
                    const worker = users.find(u => u.id === op.wId);
                    return (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{background:op.status==='completado'?'#f0fdf4':'#f9f9f7'}}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${op.status==='completado'?'bg-green-500':'bg-orange-400'}`} />
                        <span className="flex-1 text-xs font-medium text-gray-700">{op.name}</span>
                        <span className="text-[10px] text-gray-400">{op.qty?.toLocaleString('es-CO')} pzas</span>
                        {worker && (
                          <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {worker.name}
                          </span>
                        )}
                        {op.status==='completado'
                          ? <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">✓ Listo</span>
                          : isOp && (
                            <button onClick={() => completarOp(lot, op.id)}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-lg text-white"
                              style={{background:'#15803d'}}>
                              ✓ Terminar
                            </button>
                          )
                        }
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Desglose parcial */}
              {lot.cantidadesBodega && (
                <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                  <p className="text-[10px] text-blue-600 font-bold mb-1">Distribución parcial:</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(lot.cantidadesBodega).map(([gtId,qty]) => +qty>0 && (
                      <span key={gtId} className="text-[9px] bg-white border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded">
                        {gLabel(gtId)}: {qty} → Bodega Lonas
                      </span>
                    ))}
                    {lot.cantidadesOps && Object.entries(lot.cantidadesOps).map(([gtId,qty]) => +qty>0 && (
                      <span key={gtId} className="text-[9px] bg-white border border-orange-200 text-orange-700 px-1.5 py-0.5 rounded">
                        {gLabel(gtId)}: {qty} → Operaciones
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* EN REVISIÓN DE CALIDAD */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">En Revisión de Calidad ({enRevision.length})</p>
        {enRevision.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-100">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-medium text-gray-700 text-sm">Sin lotes en revisión</p>
          </div>
        )}
        {enRevision.map(lot => (
          <div key={lot.id} className="bg-white rounded-xl border-2 border-purple-200 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                  <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">🔍 En revisión calidad</span>
                </div>
                <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {lot.garments?.map((g,i) => (
                    <span key={i} className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                      {gLabel(g.gtId)}: {g.total}
                    </span>
                  ))}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => {
                    const motivo = window.prompt('¿Motivo del rechazo?');
                    if (motivo) rechazarCalidad(lot, motivo);
                  }}
                    className="text-xs font-bold px-3 py-2 rounded-lg border-2 border-red-200 text-red-600 hover:bg-red-50">
                    ✕ Rechazar
                  </button>
                  <button onClick={() => aprobarCalidad(lot)} disabled={saving}
                    className="text-xs font-bold px-3 py-2 rounded-lg text-white disabled:opacity-50"
                    style={{background:'#15803d'}}>
                    ✓ Aprobar calidad → Bodega Lonas
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
