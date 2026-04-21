import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { updateDocument, addDocument } from '../services/db';
import { advanceLotStatus } from '../services/db_timeline';
import { gLabel, fmtM } from '../utils';
import { ACCENT } from '../constants';
import toast from 'react-hot-toast';

const BODEGAS = [
  { id: 'bodega_lonas',     label: 'Bodega Lonas',             color: '#2563eb', icon: '📦' },
  { id: 'bodega_calidad',   label: 'Bodega Control de Calidad', color: '#7c3aed', icon: '🔍' },
];

const OPS_INTERNAS = [
  { id: 'pegar_boton',    name: 'Pegar botón',      val: 200  },
  { id: 'quitar_hebras',  name: 'Quitar hebras',     val: 150  },
  { id: 'doblar',         name: 'Doblar',            val: 100  },
  { id: 'empacar',        name: 'Empacar',           val: 200  },
  { id: 'revisar',        name: 'Revisión calidad',  val: 150  },
  { id: 'planchar',       name: 'Planchar',          val: 250  },
  { id: 'etiquetar',      name: 'Etiquetar',         val: 150  },
  { id: 'pegar_talla',    name: 'Pegar talla',       val: 100  },
];

export default function BodegasScreen() {
  const { profile }     = useAuth();
  const { lots, users } = useData();
  const [selLot, setSelLot]   = useState(null);
  const [tab, setTab]         = useState('bodega');
  const [bodegaDest, setBodegaDest] = useState('bodega_lonas');
  const [cantidades, setCantidades] = useState({});
  const [opsSelected, setOpsSelected] = useState([]);
  const [customOp, setCustomOp] = useState({ name:'', val:'' });
  const [saving, setSaving]   = useState(false);

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);

  // Lotes listos para asignar a bodega
  const listoBodega = lots.filter(l => l.status === 'listo_bodega');
  // Lotes ya en bodegas
  const enBodega    = lots.filter(l => ['bodega_lonas','bodega_calidad','en_operaciones_elrohi'].includes(l.status));

  const openLot = (lot) => {
    setSelLot(lot);
    setTab('bodega');
    setBodegaDest('bodega_lonas');
    const init = {};
    lot.garments?.forEach(g => { init[g.gtId] = g.total; });
    setCantidades(init);
    setOpsSelected([]);
  };

  const totalAsignar = Object.values(cantidades).reduce((a,b) => a+(+b||0), 0);

  const toggleOp = (opId) => {
    setOpsSelected(prev =>
      prev.includes(opId) ? prev.filter(id => id !== opId) : [...prev, opId]
    );
  };

  const asignarBodega = async () => {
    if (!selLot) return;
    setSaving(true);
    try {
      await advanceLotStatus(selLot.id, bodegaDest, profile?.id, profile?.name, {
        bodega: bodegaDest,
        cantidadesBodega: cantidades,
      });
      toast.success(`✅ Lote asignado a ${BODEGAS.find(b=>b.id===bodegaDest)?.label}`);
      setSelLot(null);
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  const asignarOperaciones = async () => {
    if (!selLot) return;
    if (opsSelected.length === 0) { toast.error('Selecciona al menos una operación'); return; }
    setSaving(true);
    try {
      const allOps = [...OPS_INTERNAS];
      if (customOp.name && customOp.val) {
        allOps.push({ id: `custom_${Date.now()}`, name: customOp.name, val: +customOp.val });
      }
      const opsElrohi = opsSelected.map(opId => {
        const op = allOps.find(o => o.id === opId);
        return {
          id:     `oe_${selLot.id}_${opId}`,
          opId,
          name:   op?.name || opId,
          val:    op?.val || 0,
          qty:    totalAsignar,
          status: 'pendiente',
          assignments: [],
        };
      });

      await advanceLotStatus(selLot.id, 'en_operaciones_elrohi', profile?.id, profile?.name, {
        opsElrohi,
        cantidadesOps: cantidades,
      });
      toast.success('✅ Lote enviado a Operaciones ELROHI');
      setSelLot(null);
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  const asignarParcial = async () => {
    if (!selLot) return;
    if (opsSelected.length === 0) { toast.error('Selecciona operaciones para ELROHI'); return; }
    setSaving(true);
    try {
      const allOps = [...OPS_INTERNAS];
      if (customOp.name && customOp.val) {
        allOps.push({ id: `custom_${Date.now()}`, name: customOp.name, val: +customOp.val });
      }
      const opsElrohi = opsSelected.map(opId => {
        const op = allOps.find(o => o.id === opId);
        return {
          id:     `oe_${selLot.id}_${opId}`,
          opId,
          name:   op?.name || opId,
          val:    op?.val || 0,
          qty:    totalAsignar,
          status: 'pendiente',
          assignments: [],
        };
      });

      await advanceLotStatus(selLot.id, 'en_operaciones_elrohi', profile?.id, profile?.name, {
        bodegaSecundaria: bodegaDest,
        opsElrohi,
        cantidadesOps: cantidades,
        esParcial: true,
      });
      toast.success('✅ Lote asignado parcialmente — Operaciones + Bodega');
      setSelLot(null);
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  const statusLabel = (s) => {
    const map = {
      bodega_lonas:          { label:'Bodega Lonas',            cls:'bg-blue-100 text-blue-700'   },
      bodega_calidad:        { label:'Bodega Control Calidad',  cls:'bg-purple-100 text-purple-700'},
      en_operaciones_elrohi: { label:'Operaciones ELROHI',      cls:'bg-orange-100 text-orange-700'},
    };
    return map[s] || { label: s, cls: 'bg-gray-100 text-gray-600' };
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Bodegas y Operaciones</h1>

      {/* ── LOTES LISTOS PARA ASIGNAR ── */}
      {listoBodega.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Listos para asignar ({listoBodega.length})
          </p>
          <div className="space-y-2">
            {listoBodega.map(lot => (
              <div key={lot.id} className="bg-white rounded-xl border-2 border-amber-200 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                      <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">⏳ Pendiente asignación</span>
                    </div>
                    <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {lot.garments?.map((g,i) => (
                        <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {gLabel(g.gtId)}: {g.total}
                        </span>
                      ))}
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => openLot(lot)}
                      className="text-xs font-bold px-4 py-2 rounded-lg text-white flex-shrink-0"
                      style={{ background: ACCENT }}>
                      📦 Asignar destino
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LOTES EN BODEGAS ── */}
      {enBodega.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            En bodegas / operaciones ({enBodega.length})
          </p>
          <div className="space-y-2">
            {enBodega.map(lot => {
              const st = statusLabel(lot.status);
              return (
                <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                        <span className={`${st.cls} text-[9px] px-2 py-0.5 rounded-full font-bold`}>{st.label}</span>
                      </div>
                      <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {listoBodega.length === 0 && enBodega.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium text-gray-700">Sin lotes en bodegas</p>
          <p className="text-sm text-gray-400 mt-1">Los lotes recibidos de tintorería aparecerán aquí</p>
        </div>
      )}

      {/* ── MODAL ASIGNAR DESTINO ── */}
      {selLot && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'16px',overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:580,marginTop:16,marginBottom:16}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Asignar destino del lote</h2>
              <button onClick={() => setSelLot(null)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            {/* Info lote */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <span className="font-mono text-xs font-bold text-blue-700">{selLot.code}</span>
              <p className="text-xs text-gray-500 mt-1">{selLot.totalPieces?.toLocaleString('es-CO')} piezas totales</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {selLot.garments?.map((g,i) => (
                  <span key={i} className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-700">
                    {gLabel(g.gtId)}: <strong>{g.total}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Tabs destino */}
            <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg">
              {[['bodega','📦 A Bodega'],['operaciones','⚡ A Operaciones ELROHI'],['parcial','🔀 Parcial']].map(([k,l])=>(
                <button key={k} onClick={()=>setTab(k)}
                  className="flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all"
                  style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
                  {l}
                </button>
              ))}
            </div>

            {/* ── A BODEGA ── */}
            {tab==='bodega' && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-3">Selecciona la bodega de destino:</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {BODEGAS.map(b => (
                    <button key={b.id} onClick={() => setBodegaDest(b.id)}
                      className="p-4 rounded-xl border-2 text-left transition-all"
                      style={{borderColor: bodegaDest===b.id ? b.color : '#e5e7eb', background: bodegaDest===b.id ? `${b.color}10` : '#fff'}}>
                      <p className="text-2xl mb-1">{b.icon}</p>
                      <p className="text-xs font-bold" style={{color: bodegaDest===b.id ? b.color : '#374151'}}>{b.label}</p>
                    </button>
                  ))}
                </div>
                <div className="bg-blue-50 rounded-xl p-3 mb-4 text-xs text-blue-700">
                  Se enviará el lote completo a <strong>{BODEGAS.find(b=>b.id===bodegaDest)?.label}</strong>
                </div>
                <button onClick={asignarBodega} disabled={saving}
                  className="w-full py-3 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{background: BODEGAS.find(b=>b.id===bodegaDest)?.color}}>
                  {saving ? 'Asignando...' : `📦 Enviar a ${BODEGAS.find(b=>b.id===bodegaDest)?.label}`}
                </button>
              </div>
            )}

            {/* ── A OPERACIONES ── */}
            {(tab==='operaciones' || tab==='parcial') && (
              <div>
                {tab==='parcial' && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Bodega para el resto:</p>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {BODEGAS.map(b => (
                        <button key={b.id} onClick={() => setBodegaDest(b.id)}
                          className="p-3 rounded-xl border-2 text-left"
                          style={{borderColor: bodegaDest===b.id ? b.color : '#e5e7eb', background: bodegaDest===b.id ? `${b.color}10` : '#fff'}}>
                          <p className="text-xs font-bold" style={{color: bodegaDest===b.id ? b.color : '#374151'}}>{b.icon} {b.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs font-semibold text-gray-700 mb-2">Operaciones internas a realizar:</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {OPS_INTERNAS.map(op => (
                    <button key={op.id} onClick={() => toggleOp(op.id)}
                      className="p-2.5 rounded-xl border-2 text-left transition-all"
                      style={{borderColor: opsSelected.includes(op.id) ? ACCENT : '#e5e7eb', background: opsSelected.includes(op.id) ? `${ACCENT}10` : '#fff'}}>
                      <p className="text-xs font-bold" style={{color: opsSelected.includes(op.id) ? ACCENT : '#374151'}}>{op.name}</p>
                      <p className="text-[10px] text-gray-400">{fmtM(op.val)}/pza</p>
                    </button>
                  ))}
                </div>

                {/* Op personalizada */}
                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">+ Operación personalizada</p>
                  <div className="flex gap-2">
                    <input value={customOp.name} onChange={e=>setCustomOp(f=>({...f,name:e.target.value}))}
                      placeholder="Nombre de la operación"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none" />
                    <input type="number" value={customOp.val} onChange={e=>setCustomOp(f=>({...f,val:e.target.value}))}
                      placeholder="$/pza"
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                  </div>
                </div>

                {opsSelected.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 text-xs text-orange-700">
                    <strong>{opsSelected.length}</strong> operación{opsSelected.length>1?'es':''} seleccionada{opsSelected.length>1?'s':''} para <strong>{totalAsignar.toLocaleString('es-CO')}</strong> piezas
                  </div>
                )}

                <button
                  onClick={tab==='parcial' ? asignarParcial : asignarOperaciones}
                  disabled={saving}
                  className="w-full py-3 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{background: ACCENT}}>
                  {saving ? 'Asignando...' : tab==='parcial' ? '🔀 Asignar parcial — Ops + Bodega' : '⚡ Enviar a Operaciones ELROHI'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
