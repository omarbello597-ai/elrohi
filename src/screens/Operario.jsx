import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { updateLotOp, listenCol } from '../services/db';
import { ProgressBar, EmptyState } from '../components/ui';
import { fmtM, getOpVal, today } from '../utils';
import { ACCENT } from '../constants';
import { orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';

// ─── MIS OPERACIONES ─────────────────────────────────────────────────────────
export function MisOpsScreen() {
  const { profile }              = useAuth();
  const { lots, ops, satOpVals } = useData();

  const myLots = lots.filter((l) => l.satId === profile.satId && l.status === 'costura');
  const allOps = myLots.flatMap((l) =>
    (l.lotOps || []).map((lo) => ({
      ...lo,
      lotId:   l.id,
      lotCode: l.code,
      satId:   l.satId,
      op:      ops.find((o) => o.id === lo.opId),
      tipo:    'costura',
    }))
  );

  const lotesElrohi = lots.filter(l => ['en_operaciones_elrohi','bodega_calidad'].includes(l.status));
  const opsElrohi   = lotesElrohi.flatMap(l =>
    (l.opsElrohi || [])
      .filter(op => op.wId === profile.id)
      .map(op => ({ ...op, lotId: l.id, lotCode: l.code, tipo: 'elrohi' }))
  );

  const mine  = [...allOps.filter((o) => o.wId === profile.id), ...opsElrohi];
  const avail = allOps.filter((o) => o.status === 'pendiente' && !o.wId);

  const take = async (lotId, loId, tipo) => {
    try {
      if (tipo === 'elrohi') {
        const lot = lots.find(l=>l.id===lotId);
        if (!lot) return;
        const upd = (lot.opsElrohi||[]).map(op =>
          op.id===loId ? {...op, status:'en_proceso', startedAt:new Date().toISOString()} : op
        );
        const { updateDocument } = await import('../services/db');
        await updateDocument('lots', lotId, {opsElrohi:upd});
        toast.success('¡Operación iniciada!');
      } else {
        await updateLotOp(lotId, loId, { wId: profile.id, status: 'en_proceso' });
        toast.success('Operación tomada');
      }
    } catch { toast.error('Error'); }
  };

  const complete = async (lotId, loId, tipo) => {
    try {
      if (tipo === 'elrohi') {
        const lot = lots.find(l=>l.id===lotId);
        if (!lot) return;
        const upd = (lot.opsElrohi||[]).map(op =>
          op.id===loId ? {...op, status:'completado', doneAt:new Date().toISOString()} : op
        );
        const allDone = upd.every(op=>op.status==='completado');
        const { updateDocument } = await import('../services/db');
        const { advanceLotStatus } = await import('../services/db_timeline');
        if (allDone) {
          await advanceLotStatus(lot.id,'en_revision_calidad',profile.id,profile.name,{opsElrohi:upd});
          toast.success('✅ Todas las operaciones completas — lote en revisión de calidad');
        } else {
          await updateDocument('lots', lotId, {opsElrohi:upd});
          toast.success('¡Operación completada!');
        }
      } else {
        const lot = lots.find(l=>l.id===lotId);
        if (!lot) return;
        const updLotOps = (lot.lotOps||[]).map(lo =>
          lo.id===loId ? {...lo, status:'completado', doneAt:new Date().toISOString()} : lo
        );
        const allDone = updLotOps.every(lo=>lo.status==='completado');
        const { updateDocument } = await import('../services/db');
        const { advanceLotStatus } = await import('../services/db_timeline');
        if (allDone) {
          await advanceLotStatus(lotId,'listo_remision_tintoreria',profile.id,profile.name,{lotOps:updLotOps});
          toast.success('✅ ¡Todas las operaciones del corte completadas! Listo para tintorería');
        } else {
          await updateDocument('lots', lotId, {lotOps:updLotOps});
          toast.success('¡Operación completada!');
        }
      }
    } catch(e) { console.error(e); toast.error('Error'); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Mis Operaciones</h1>

      {mine.length > 0 && (
        <div className="space-y-3 mb-5">
          {mine.map((lo) => {
            const valUnit = lo.val || getOpVal(ops, satOpVals, lo.satId, lo.opId);
            const valTot  = valUnit * (lo.qty||0);
            const nombre  = lo.name || lo.op?.name || lo.operacion || '?';
            return (
              <div key={lo.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-[10px] text-blue-600">{lo.lotCode}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                        lo.status==='completado'?'bg-green-100 text-green-700':
                        lo.status==='en_proceso'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-500'}`}>
                        {lo.status==='completado'?'✅ Completado':lo.status==='en_proceso'?'⚡ En proceso':'⏳ Pendiente'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-800">{nombre}</p>
                    {lo.referencia && <p className="text-[10px] text-gray-400">{lo.referencia}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{(lo.qty||0).toLocaleString('es-CO')} pzas</p>
                    <p className="text-xs text-gray-400">× {fmtM(valUnit)}</p>
                    <p className="text-sm font-black text-green-700">{fmtM(valTot)}</p>
                  </div>
                </div>
                {lo.status === 'pendiente' && (
                  <button onClick={() => take(lo.lotId, lo.id, lo.tipo)}
                    className="w-full py-2 text-white text-xs font-bold rounded-lg"
                    style={{background:'#2878B4'}}>▶ Iniciar</button>
                )}
                {lo.status === 'en_proceso' && (
                  <button onClick={() => complete(lo.lotId, lo.id, lo.tipo)}
                    className="w-full py-2 text-white text-xs font-bold rounded-lg"
                    style={{background:'#15803d'}}>✓ Terminé</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {avail.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Operaciones Disponibles</p>
          <div className="space-y-1.5">
            {avail.slice(0, 8).map((lo) => {
              const valUnit = lo.val || getOpVal(ops, satOpVals, lo.satId, lo.opId);
              return (
                <div key={lo.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{lo.op?.name || lo.name || '?'}</p>
                    <p className="text-[10px] text-gray-400">{lo.lotCode} · {lo.qty} pzas · {fmtM(valUnit)}/pza = <strong>{fmtM(valUnit*(lo.qty||0))}</strong></p>
                  </div>
                  <button onClick={() => take(lo.lotId, lo.id, lo.tipo)}
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
        <EmptyState emoji="🔧" title="Sin operaciones" sub="No hay operaciones asignadas ni disponibles" />
      )}
    </div>
  );
}

// ─── MI QUINCENA ─────────────────────────────────────────────────────────────
export function QuincenaScreen() {
  const { profile }              = useAuth();
  const { lots, ops, satOpVals } = useData();
  const [pagos,     setPagos]    = useState([]);
  const [activeTab, setActiveTab] = useState('quincena');

  useEffect(()=>{
    const unsub = listenCol('nominasSatelite', setPagos, orderBy('createdAt','desc'));
    return unsub;
  },[]);

  // Operaciones completadas del operario
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

  // Usar lo.val directamente (ya incluye el valor real)
  const total = completedOps.reduce((acc, lo) => {
    const val = lo.val || getOpVal(ops, satOpVals, lo.satId, lo.opId);
    return acc + val * (lo.qty||0);
  }, 0);

  // Mis pagos recibidos de Claudia
  const misPagos = pagos.filter(p => p.operarioId === profile.id);
  const yaPagado = misPagos.length > 0;

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Mi Quincena</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['quincena','💰 Mi Quincena'],['pagos','📋 Mis Pagos']].map(([k,l])=>(
          <button key={k} onClick={()=>setActiveTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:activeTab===k?'#fff':'transparent',color:activeTab===k?'#111827':'#6b7280',
              fontWeight:activeTab===k?700:400,boxShadow:activeTab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}{k==='pagos'&&misPagos.length>0?` (${misPagos.length})`:''}
          </button>
        ))}
      </div>

      {/* MI QUINCENA */}
      {activeTab==='quincena' && (
        <div>
          {yaPagado && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-2">
              <span className="text-green-600 text-lg">✅</span>
              <p className="text-xs font-bold text-green-700">Tu quincena ya fue pagada — revisa Mis Pagos</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border-2 border-green-200 p-6 text-center mb-5">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Acumulado</p>
            <p className="text-4xl font-black text-green-500 mb-1" style={{letterSpacing:'-0.04em'}}>{fmtM(total)}</p>
            <p className="text-xs text-gray-400">{completedOps.length} operaciones completadas</p>
          </div>

          {completedOps.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-2.5" style={{background:'#14405A'}}>
                <p className="text-[10px] font-bold text-white uppercase tracking-wider">Detalle de operaciones</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      {['Corte','Operación','Piezas','Valor/pza','Subtotal'].map((c) => (
                        <th key={c} className="text-left px-3 py-2.5 text-[10px] text-gray-400 font-medium uppercase tracking-wide">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {completedOps.map((lo, i) => {
                      const valUnit = lo.val || getOpVal(ops, satOpVals, lo.satId, lo.opId);
                      const valTot  = valUnit * (lo.qty||0);
                      return (
                        <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-[10px] text-blue-600">{lo.lotCode}</td>
                          <td className="px-3 py-2 font-medium text-gray-800">{lo.op?.name || lo.name || '?'}</td>
                          <td className="px-3 py-2 text-gray-600">{(lo.qty||0).toLocaleString('es-CO')}</td>
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
            </div>
          ) : (
            <EmptyState emoji="💵" title="Sin operaciones completadas" sub="Completa operaciones para ver tu quincena acumulada" />
          )}
        </div>
      )}

      {/* MIS PAGOS */}
      {activeTab==='pagos' && (
        <div className="space-y-3">
          {misPagos.length===0 && (
            <EmptyState emoji="📋" title="Sin pagos recibidos" sub="Aquí aparecerán los pagos que tu taller te registre" />
          )}
          {misPagos.map(p=>(
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✅ Pagado</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{p.periodo}</p>
                  <p className="text-[10px] text-gray-400">{p.fechaPago}</p>
                  {/* Detalle operaciones */}
                  {(p.detalle?.ops||[]).length>0 && (
                    <div className="mt-2 space-y-0.5">
                      {p.detalle.ops.map((o,i)=>(
                        <p key={i} className="text-[10px] text-gray-500">
                          {o.lotCode} · {o.opName} × {(o.qty||0).toLocaleString('es-CO')} pzas = <strong>{fmtM(o.subtotal)}</strong>
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="text-sm font-black text-green-700 mt-2">{fmtM(p.total)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
