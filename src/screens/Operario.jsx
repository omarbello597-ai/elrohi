import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { updateLotOp } from '../services/db';
import { ProgressBar, EmptyState } from '../components/ui';
import { fmtM, getOpVal, today, workerQuincena } from '../utils';
import { ACCENT } from '../constants';
import toast from 'react-hot-toast';

// ─── MIS OPERACIONES ─────────────────────────────────────────────────────────
export function MisOpsScreen() {
  const { profile }              = useAuth();
  const { lots, ops, satOpVals } = useData();

  // Operaciones de costura (satélite)
  const myLots   = lots.filter((l) => l.satId === profile.satId && l.status === 'costura');
  const allOps   = myLots.flatMap((l) =>
    (l.lotOps || []).map((lo) => ({
      ...lo,
      lotId:   l.id,
      lotCode: l.code,
      satId:   l.satId,
      op:      ops.find((o) => o.id === lo.opId),
      tipo:    'costura',
    }))
  );

  // Operaciones internas ELROHI (terminacion/control calidad)
  const lotesElrohi = lots.filter(l => ['en_operaciones_elrohi','bodega_calidad'].includes(l.status));
  const opsElrohi   = lotesElrohi.flatMap(l =>
    (l.opsElrohi || [])
      .filter(op => op.wId === profile.id)
      .map(op => ({
        ...op,
        lotId:   l.id,
        lotCode: l.code,
        tipo:    'elrohi',
      }))
  );

  const mine  = [...allOps.filter((o) => o.wId === profile.id), ...opsElrohi];
  const avail = allOps.filter((o) => o.status === 'pendiente' && !o.wId);

  const take = async (lotId, loId) => {
    try {
      await updateLotOp(lotId, loId, { wId: profile.id, status: 'en_proceso' });
      toast.success('Operación tomada');
    } catch { toast.error('Error'); }
  };

  const complete = async (lotId, loId, tipo) => {
    try {
      if (tipo === 'elrohi') {
        // Operación interna ELROHI
        const lot = lots.find(l=>l.id===lotId);
        if (!lot) return;
        const opsElrohiUpd = (lot.opsElrohi||[]).map(op =>
          op.id===loId ? {...op, status:'completado', doneAt:new Date().toISOString()} : op
        );
        const allDone = opsElrohiUpd.every(op=>op.status==='completado');
        const { updateDocument } = await import('../services/db');
        const { advanceLotStatus } = await import('../services/db_timeline');
        if (allDone) {
          await advanceLotStatus(lot.id,'en_revision_calidad',profile.id,profile.name,{opsElrohi:opsElrohiUpd});
          toast.success('✅ Todas las operaciones completas — lote en revisión de calidad');
        } else {
          await updateDocument('lots', lotId, {opsElrohi:opsElrohiUpd});
          toast.success('¡Operación completada!');
        }
      } else {
        await updateLotOp(lotId, loId, { status: 'completado', done: today() });
        toast.success('¡Operación completada!');
      }
    } catch(e) { console.error(e); toast.error('Error'); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Hola, {profile.name?.split(' ')[0]} 👋</h1>

      {/* My active operations */}
      {mine.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Mis Operaciones</p>
          <div className="space-y-2">
            {mine.map((lo) => {
              const valUnit = getOpVal(ops, satOpVals, lo.satId, lo.opId);
              const valTot  = valUnit * lo.qty;
              const border  = lo.status === 'completado' ? '#bbf7d0' : lo.status === 'en_proceso' ? '#bfdbfe' : '#e5e7eb';
              return (
                <div key={lo.id} className="bg-white rounded-xl p-4 border-2 flex items-center justify-between gap-3" style={{ borderColor: border }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{lo.status === 'completado' ? '✅' : lo.status === 'en_proceso' ? '⚡' : '○'}</span>
                      <span className="text-sm font-bold text-gray-900">{lo.op?.name || '?'}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mb-1">{lo.lotCode} · {lo.qty} piezas</p>
                    <p className="text-xs font-bold" style={{ color: lo.status === 'completado' ? '#10b981' : '#374151' }}>
                      {fmtM(valUnit)}/pza × {lo.qty} = {fmtM(valTot)}
                    </p>
                  </div>
                  <div>
                    {lo.status === 'en_proceso' && (
                      <button onClick={() => complete(lo.lotId, lo.id, lo.tipo)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600">
                        ✓ Terminé
                      </button>
                    )}
                    {lo.status === 'pendiente' && (
                      <button onClick={() => take(lo.lotId, lo.id)}
                        className="px-4 py-2 text-white rounded-lg text-xs font-bold"
                        style={{ background: ACCENT }}>
                        ▶ Iniciar
                      </button>
                    )}
                    {lo.status === 'completado' && (
                      <span className="text-xs text-green-600 font-semibold">{lo.done}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available operations */}
      {avail.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Operaciones Disponibles</p>
          <div className="space-y-1.5">
            {avail.slice(0, 8).map((lo) => {
              const valUnit = getOpVal(ops, satOpVals, lo.satId, lo.opId);
              const valTot  = valUnit * lo.qty;
              return (
                <div key={lo.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{lo.op?.name || '?'}</p>
                    <p className="text-[10px] text-gray-400">{lo.lotCode} · {lo.qty} pzs · {fmtM(valUnit)}/pza = <strong>{fmtM(valTot)}</strong></p>
                  </div>
                  <button onClick={() => take(lo.lotId, lo.id)}
                    className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200">
                    Tomar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mine.length === 0 && avail.length === 0 && (
        <EmptyState emoji="🔧" title="Sin operaciones" sub="No hay operaciones asignadas ni disponibles en este momento" />
      )}
    </div>
  );
}

// ─── MI QUINCENA ─────────────────────────────────────────────────────────────
export function QuincenaScreen() {
  const { profile }              = useAuth();
  const { lots, ops, satOpVals } = useData();

  // All completed operations for this worker
  const completedOps = lots.flatMap((l) =>
    (l.lotOps || [])
      .filter((lo) => lo.wId === profile.id && lo.status === 'completado')
      .map((lo) => ({
        ...lo,
        lotCode: l.code,
        satId:   l.satId,
        op:      ops.find((o) => o.id === lo.opId),
      }))
  );

  // ✅ Total = valor_efectivo × piezas (correcto)
  const total = completedOps.reduce((acc, lo) => {
    const val = getOpVal(ops, satOpVals, lo.satId, lo.opId);
    return acc + val * lo.qty;
  }, 0);

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Mi Quincena</h1>

      {/* Total card */}
      <div className="bg-white rounded-2xl border-2 border-green-200 p-6 text-center mb-5">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Acumulado (Quincena actual)</p>
        <p className="text-4xl font-black text-green-500 mb-1" style={{ letterSpacing: '-0.04em' }}>{fmtM(total)}</p>
        <p className="text-xs text-gray-400">{completedOps.length} operaciones completadas</p>
      </div>

      {/* Detail table */}
      {completedOps.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['Lote', 'Operación', 'Piezas', 'Valor/pza', 'Subtotal'].map((c) => (
                  <th key={c} className="text-left px-3 py-2.5 text-[10px] text-gray-400 font-medium uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completedOps.map((lo, i) => {
                const valUnit = getOpVal(ops, satOpVals, lo.satId, lo.opId);
                const valTot  = valUnit * lo.qty;
                return (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-500">{lo.lotCode}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{lo.op?.name || '?'}</td>
                    <td className="px-3 py-2 text-gray-600">{lo.qty}</td>
                    <td className="px-3 py-2 font-mono text-gray-500">{fmtM(valUnit)}</td>
                    <td className="px-3 py-2 font-bold font-mono text-green-600">{fmtM(valTot)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-green-50">
                <td colSpan={4} className="px-3 py-3 font-bold text-gray-800">TOTAL QUINCENA</td>
                <td className="px-3 py-3 font-black text-green-600 font-mono text-sm">{fmtM(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <EmptyState emoji="💵" title="Sin operaciones completadas" sub="Completa operaciones para ver tu quincena acumulada" />
      )}
    </div>
  );
}
