import { useState, useEffect } from 'react';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { ACCENT } from '../constants';
import { orderBy } from 'firebase/firestore';
import { fmtM } from '../utils';
import toast from 'react-hot-toast';

const emptyForm = () => ({
  descripcion:'', confeccion:0, terminacion:0, remate:0,
});

const calcTotal = (f) => (+f.confeccion||0) + (+f.terminacion||0) + (+f.remate||0);

export default function TarifasSateliteScreen() {
  const [tarifas,   setTarifas]   = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [form,      setForm]      = useState(emptyForm());
  const [saving,    setSaving]    = useState(false);

  useEffect(()=>{
    const unsub = listenCol('tarifasSatelite', setTarifas, orderBy('descripcion','asc'));
    return unsub;
  },[]);

  const openNew = () => { setEditItem(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (t) => {
    setEditItem(t);
    setForm({ descripcion:t.descripcion, confeccion:t.confeccion||0, terminacion:t.terminacion||0, remate:t.remate||0 });
    setShowModal(true);
  };

  const guardar = async () => {
    if (!form.descripcion) { toast.error('La descripción es obligatoria'); return; }
    setSaving(true);
    try {
      const data = { ...form, confeccion:+form.confeccion||0, terminacion:+form.terminacion||0, remate:+form.remate||0, total: calcTotal(form), active:true };
      if (editItem) {
        await updateDocument('tarifasSatelite', editItem.id, data);
        toast.success('✅ Tarifa actualizada');
      } else {
        await addDocument('tarifasSatelite', data);
        toast.success('✅ Tarifa creada');
      }
      setShowModal(false);
    } catch(e){ toast.error('Error'); }
    finally { setSaving(false); }
  };

  const eliminar = async (t) => {
    if (!window.confirm(`¿Eliminar tarifa "${t.descripcion}"?`)) return;
    await updateDocument('tarifasSatelite', t.id, { active:false });
    toast.success('Tarifa eliminada');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-bold text-gray-900">Tarifas Satélite</h1>
          <p className="text-xs text-gray-400">{tarifas.filter(t=>t.active!==false).length} referencias activas</p>
        </div>
        <button onClick={openNew}
          className="text-xs font-bold px-4 py-2 rounded-lg text-white" style={{background:ACCENT}}>
          + Nueva Tarifa
        </button>
      </div>

      {/* Tabla de tarifas */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{background:'#1a3a6b'}}>
                {['Descripción','Confección','Terminación','Remate','Total',''].map(h=>(
                  <th key={h} className="px-3 py-2.5 text-left text-white font-bold text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tarifas.filter(t=>t.active!==false).map((t,i)=>(
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50"
                  style={{background:i%2===0?'#fff':'#fafafa'}}>
                  <td className="px-3 py-2 font-bold text-gray-800">{t.descripcion}</td>
                  <td className="px-3 py-2 text-gray-600">{t.confeccion>0?fmtM(t.confeccion):'—'}</td>
                  <td className="px-3 py-2 text-gray-600">{t.terminacion>0?fmtM(t.terminacion):'—'}</td>
                  <td className="px-3 py-2 text-gray-600">{t.remate>0?fmtM(t.remate):'—'}</td>
                  <td className="px-3 py-2 font-black" style={{color:'#15803d'}}>{fmtM(t.total||0)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={()=>openEdit(t)}
                        className="text-[10px] px-2 py-1 bg-gray-100 text-gray-700 rounded font-medium hover:bg-gray-200">✏️</button>
                      <button onClick={()=>eliminar(t)}
                        className="text-[10px] px-2 py-1 bg-red-100 text-red-700 rounded font-medium hover:bg-red-200">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tarifas.filter(t=>t.active!==false).length===0 && (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">💰</p>
            <p className="text-sm text-gray-500">Sin tarifas registradas</p>
            <p className="text-xs text-gray-400 mt-1">Agrega las referencias con el botón de arriba</p>
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:440}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">{editItem?'Editar':'Nueva'} Tarifa</h2>
              <button onClick={()=>setShowModal(false)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción *</label>
                <input value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))}
                  placeholder="Ej: PANTALON LINEA"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[['confeccion','Confección'],['terminacion','Terminación'],['remate','Remate']].map(([k,l])=>(
                  <div key={k}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
                    <input type="number" min={0} value={form[k]}
                      onChange={e=>setForm(f=>({...f,[k]:+e.target.value||0}))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-orange-400" />
                  </div>
                ))}
              </div>

              {/* Total calculado */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex justify-between items-center">
                <span className="text-xs font-bold text-green-700">Total por pieza completa</span>
                <span className="text-lg font-black text-green-800">{fmtM(calcTotal(form))}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={guardar} disabled={saving}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:ACCENT}}>
                {saving?'Guardando...':editItem?'Actualizar':'Crear Tarifa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
