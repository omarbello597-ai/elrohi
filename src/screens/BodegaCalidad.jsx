import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { updateDocument } from '../services/db';
import { advanceLotStatus } from '../services/db_timeline';
import { gLabel } from '../utils';
import { ACCENT } from '../constants';
import toast from 'react-hot-toast';

export default function BodegaCalidadScreen() {
  const { profile } = useAuth();
  const { lots, users } = useData();
  const [saving, setSaving] = useState(false);

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);
  const isOp    = ['bodega_op','terminacion','operario','corte','pespunte','despachos'].includes(profile?.role) || isAdmin;

  const enOps      = lots.filter(l => l.status === 'en_operaciones_elrohi');
  const enRevision = lots.filter(l => l.status === 'en_revision_calidad');

  // Todos los usuarios ELROHI — sin filtro de rol para incluir todos
  const operariosElrohi = users.filter(u => u.active !== false);

  const asignarOperario = async (lot, opId, operarioId) => {
    if (!operarioId) return;
    const worker = users.find(u => u.id === operarioId);
    const opsElrohi = (lot.opsElrohi || []).map(op =>
      op.id === opId ? { ...op, wId: operarioId, workerName: worker?.name || '' } : op
    );
    try {
      await updateDocument('lots', lot.id, { opsElrohi });
      toast.success(`✅ Asignado a ${worker?.name}`);
    } catch { toast.error('Error al asignar'); }
  };

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
        toast.success('Operación completada');
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
      toast.success('✅ Aprobado — pasa a Bodega Lonas');
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  const rechazarCalidad = async (lot) => {
    const motivo = window.prompt('¿Motivo del rechazo?');
    if (!motivo) return;
    try {
      await advanceLotStatus(lot.id, 'en_operaciones_elrohi', profile?.id, profile?.name, {
        rechazoCalidad: { motivo, por: profile?.name, at: new Date().toISOString() },
      });
      toast.success('Lote devuelto a operaciones');
    } catch { toast.error('Error'); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-1">Bodega Control de Calidad</h1>
      <p className="text-xs text-gray-500 mb-4">Operaciones internas y revisión antes de pasar a Bodega Lonas</p>

      {/* EN OPERACIONES */}
      <div className="mb-6">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          En Operaciones Internas ({enOps.length})
        </p>
        {enOps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-100">
            <p className="text-3xl mb-2">⚡</p>
            <p className="font-medium text-gray-700 text-sm">Sin cortes en operaciones</p>
          </div>
        )}
        {enOps.map(lot => {
          const ops  = lot.opsElrohi || [];
          const done = ops.filter(o => o.status === 'completado').length;
          const prog = ops.length > 0 ? Math.round(done/ops.length*100) : 0;
          return (
            <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                    <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">⚡ Operaciones ELROHI</span>
                  </div>
                  <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-black" style={{color:prog===100?'#15803d':'#e85d26'}}>{prog}%</p>
                  <p className="text-[9px] text-gray-400">{done}/{ops.length} ops</p>
                </div>
              </div>

              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div className="h-full rounded-full" style={{width:`${prog}%`,background:prog===100?'#10b981':ACCENT}} />
              </div>

              {ops.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                  ⚠ Este lote no tiene operaciones definidas.
                </div>
              )}

              <div className="space-y-3">
                {ops.map((op,i) => {
                  const worker = users.find(u => u.id === op.wId);
                  return (
                    <div key={i} className="border rounded-xl p-3"
                      style={{borderColor:op.status==='completado'?'#86efac':'#fed7aa',background:op.status==='completado'?'#f0fdf4':'#fff8f4'}}>

                      {/* Header op */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${op.status==='completado'?'bg-green-500':'bg-orange-400'}`} />
                        <span className="flex-1 text-xs font-bold text-gray-800">{op.name}</span>
                        <span className="text-[10px] text-gray-400">{op.qty?.toLocaleString('es-CO')} pzas</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${op.status==='completado'?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'}`}>
                          {op.status==='completado'?'✓ Completado':'Pendiente'}
                        </span>
                      </div>

                      {op.status !== 'completado' && (
                        <div className="space-y-2">
                          {/* Selector operario — SIEMPRE VISIBLE para admin */}
                          {isAdmin && (
                            <div className="bg-white rounded-lg border border-orange-200 p-2">
                              <p className="text-[10px] font-bold text-orange-700 mb-1.5">
                                👤 Asignar operario ELROHI:
                              </p>
                              <select
                                value={op.wId || ''}
                                onChange={e => asignarOperario(lot, op.id, e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-orange-400">
                                <option value="">— Seleccionar operario —</option>
                                {operariosElrohi.map(w => (
                                  <option key={w.id} value={w.id}>{w.name} ({w.role})</option>
                                ))}
                              </select>
                              {op.wId && worker && (
                                <p className="text-[10px] text-green-600 font-bold mt-1">
                                  ✓ Asignado a: {worker.name}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Botón completar */}
                          {op.wId && (
                            <button
                              onClick={() => completarOp(lot, op.id)}
                              className="w-full py-2 text-white text-xs font-bold rounded-lg"
                              style={{background:'#15803d'}}>
                              ✓ Marcar como completada
                            </button>
                          )}

                          {!op.wId && !isAdmin && (
                            <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded-lg">
                              ⏳ Esperando que Admin asigne un operario
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* EN REVISIÓN DE CALIDAD */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          En Revisión de Calidad ({enRevision.length})
        </p>
        {enRevision.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-100">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-medium text-gray-700 text-sm">Sin cortes en revisión</p>
          </div>
        )}
        {enRevision.map(lot => (
          <div key={lot.id} className="bg-white rounded-xl border-2 border-purple-200 p-4 mb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
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
                  <button onClick={() => rechazarCalidad(lot)} disabled={saving}
                    className="text-xs font-bold px-3 py-2 rounded-lg border-2 border-red-200 text-red-600 hover:bg-red-50">
                    ✕ Rechazar
                  </button>
                  <button onClick={() => aprobarCalidad(lot)} disabled={saving}
                    className="text-xs font-bold px-3 py-2 rounded-lg text-white disabled:opacity-50"
                    style={{background:'#15803d'}}>
                    ✓ Aprobar → Bodega Lonas
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
