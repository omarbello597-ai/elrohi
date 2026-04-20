import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { advanceLotStatus } from '../services/db_timeline';
import { gLabel, fmtM } from '../utils';
import { ACCENT } from '../constants';
import { orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';

// ─── SEMÁFORO ─────────────────────────────────────────────────────────────────
const Semaforo = ({ status }) => {
  const cfg = {
    verde:    { bg:'#dcfce7', color:'#15803d', label:'✓ Completo'          },
    amarillo: { bg:'#fef9c3', color:'#92400e', label:'⚠ Validando faltante' },
    rojo:     { bg:'#fee2e2', color:'#dc2626', label:'✕ Pérdida confirmada'  },
  };
  const c = cfg[status] || cfg.amarillo;
  return <span style={{background:c.bg,color:c.color,fontSize:'9px',fontWeight:700,padding:'2px 8px',borderRadius:20}}>{c.label}</span>;
};

export default function RecepcionTintoreria() {
  const { profile } = useAuth();
  const { lots } = useData();
  const [tab, setTab] = useState('pendientes');
  const [recepciones, setRecepciones] = useState([]);
  const [selLotId, setSelLotId] = useState('');
  const [recibido, setRecibido] = useState({});
  const [novedades, setNovedades] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = listenCol('recepcionesTinto', setRecepciones, orderBy('createdAt','desc'));
    return unsub;
  }, []);

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);

  // Lotes en tintorería listos para recibir
  const tintoLots = lots.filter(l => l.status === 'tintoreria');
  const selLot = lots.find(l => l.id === selLotId);

  const calcSemaforo = (gtId, original, recibidas) => {
    if (!recibidas && recibidas !== 0) return null;
    const rec = +recibidas || 0;
    if (rec >= original) return 'verde';
    if (rec > 0)         return 'amarillo';
    return 'rojo';
  };

  const confirmarRecepcion = async () => {
    if (!selLot) { toast.error('Selecciona un lote'); return; }
    setSaving(true);
    try {
      const garmentReview = selLot.garments?.map(g => {
        const rec = +recibido[g.gtId] || 0;
        const semaforo = calcSemaforo(g.gtId, g.total, rec);
        const faltante = g.total - rec;
        return { gtId: g.gtId, original: g.total, recibido: rec, faltante: Math.max(0,faltante), semaforo };
      });

      const todoVerde = garmentReview.every(g => g.semaforo === 'verde');
      const hayRojo   = garmentReview.some(g => g.semaforo === 'rojo');
      const statusRecepcion = todoVerde ? 'completo' : hayRojo ? 'perdida' : 'validando';

      await addDocument('recepcionesTinto', {
        lotId: selLot.id, lotCode: selLot.code,
        garmentReview, novedades,
        statusRecepcion,
        recibidoPor: profile?.name,
        recibidoPorId: profile?.id,
        fecha: new Date().toISOString().split('T')[0],
      });

      await advanceLotStatus(selLot.id, 'listo_bodega', profile?.id, profile?.name, {
        recepcionTinto: { garmentReview, statusRecepcion, novedades },
      });

      toast.success('✅ Recepción registrada — lote listo para bodega');
      setSelLotId(''); setRecibido({}); setNovedades('');
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Recepción de Tintorería</h1>

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['nueva','Recibir Lote'],['historial','Historial']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'nueva' && (
        <div>
          {/* Selector de lote */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Lotes en tintorería — selecciona el que vas a recibir
            </label>
            <select value={selLotId} onChange={e => setSelLotId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400">
              <option value="">— Seleccionar lote —</option>
              {tintoLots.map(l => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.totalPieces?.toLocaleString('es-CO')} pzs
                  {l.corteNumero ? ` · Corte #${l.corteNumero}` : ''}
                </option>
              ))}
            </select>
            {tintoLots.length === 0 && (
              <p className="text-xs text-gray-400 mt-2">No hay lotes en tintorería actualmente.</p>
            )}
          </div>

          {selLot && (
            <>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-blue-700">{selLot.code}</span>
                  {selLot.corteNumero && <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Corte #{selLot.corteNumero}</span>}
                </div>
                <p className="text-xs text-indigo-700">Total original: <strong>{selLot.totalPieces?.toLocaleString('es-CO')} piezas</strong></p>
              </div>

              {/* Tabla de recepción */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
                <div className="px-4 py-3 border-b border-gray-100" style={{background:'#1a3a6b'}}>
                  <p className="text-[10px] font-bold text-white uppercase tracking-wider">Conteo de prendas recibidas de Tintorería</p>
                </div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr style={{background:'#f9fafb'}}>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Prenda</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-medium">Enviadas</th>
                      <th className="px-3 py-2 text-center text-gray-600 font-bold">Recibidas</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-medium">Faltante</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selLot.garments?.map((g,i) => {
                      const rec = recibido[g.gtId];
                      const semaforo = rec !== undefined ? calcSemaforo(g.gtId, g.total, rec) : null;
                      const faltante = rec !== undefined ? Math.max(0, g.total - (+rec||0)) : null;
                      return (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-3 py-2.5 font-medium text-gray-800">{gLabel(g.gtId)}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-blue-700">{g.total?.toLocaleString('es-CO')}</td>
                          <td className="px-3 py-2.5">
                            <input type="number" min={0} max={g.total} value={rec||''}
                              onChange={e => setRecibido(r => ({...r,[g.gtId]:e.target.value}))}
                              placeholder={g.total}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-center text-sm font-bold focus:outline-none focus:border-indigo-400"
                              style={{color: semaforo==='verde'?'#15803d':semaforo==='rojo'?'#dc2626':'#1a3a6b'}} />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {faltante !== null && <span style={{color:faltante>0?'#dc2626':'#15803d',fontWeight:700}}>{faltante > 0 ? `-${faltante}` : '✓'}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {semaforo && <Semaforo status={semaforo} />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Novedades y observaciones</label>
                <textarea value={novedades} onChange={e=>setNovedades(e.target.value)}
                  placeholder="Registra aquí cualquier novedad: prendas con defectos, manchas, faltantes, etc."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:border-indigo-400" />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800">
                💡 Si hay faltantes quedará en <strong>amarillo</strong> para validar con el satélite. Si finalmente no aparecen las prendas, el estado pasará a <strong>rojo</strong> y se asignará la pérdida a quien corresponda.
              </div>

              <button onClick={confirmarRecepcion} disabled={saving}
                className="w-full py-3 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:'#1a3a6b'}}>
                {saving ? 'Registrando...' : '📥 Confirmar recepción y pasar a Bodega'}
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'historial' && (
        <div className="space-y-3">
          {recepciones.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium text-gray-700">Sin recepciones registradas</p>
            </div>
          )}
          {recepciones.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-bold text-blue-700">{r.lotCode}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${r.statusRecepcion==='completo'?'bg-green-100 text-green-700':r.statusRecepcion==='perdida'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>
                      {r.statusRecepcion==='completo'?'✓ Completo':r.statusRecepcion==='perdida'?'✕ Pérdida':'⚠ Validando'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400">{r.fecha} · Recibido por: {r.recibidoPor}</p>
                </div>
              </div>
              {r.garmentReview?.map((g,i) => (
                <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-gray-50">
                  <span className="flex-1 text-gray-700">{gLabel(g.gtId)}</span>
                  <span className="text-blue-600">Enviadas: {g.original}</span>
                  <span className="text-gray-700">Recibidas: <strong>{g.recibido}</strong></span>
                  {g.faltante > 0 && <span className="text-red-600 font-bold">-{g.faltante}</span>}
                  <Semaforo status={g.semaforo} />
                </div>
              ))}
              {r.novedades && <p className="text-xs text-gray-500 italic mt-2 bg-gray-50 rounded p-2">"{r.novedades}"</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
