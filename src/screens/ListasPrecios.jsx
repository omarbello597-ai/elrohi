import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { gLabel, fmtM } from '../utils';
import { GARMENT_TYPES, ACCENT } from '../constants';
import { orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function ListasPreciosScreen() {
  const { profile } = useAuth();
  const [listas, setListas] = useState([]);
  const [vista, setVista] = useState('inicio'); // 'inicio' | lista.id
  const [showNew, setShowNew] = useState(false);
  const [editLista, setEditLista] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = listenCol('listasPrecios', setListas, orderBy('createdAt', 'desc'));
    return unsub;
  }, []);

  const isAdmin = ['gerente', 'admin_elrohi'].includes(profile?.role);

  const listaActual = listas.find(l => l.id === vista);

  const crearLista = async () => {
    if (!form.nombre) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const precios = {};
      GARMENT_TYPES.forEach(g => { precios[g.id] = 0; });
      if (editLista) {
        await updateDocument('listasPrecios', editLista.id, { nombre: form.nombre, descripcion: form.descripcion });
        toast.success('✅ Lista actualizada');
      } else {
        await addDocument('listasPrecios', { nombre: form.nombre, descripcion: form.descripcion, precios, active: true });
        toast.success('✅ Lista de precios creada');
      }
      setShowNew(false); setEditLista(null); setForm({ nombre:'', descripcion:'' });
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  const updatePrecio = async (listaId, gtId, valor) => {
    const lista = listas.find(l => l.id === listaId);
    const precios = { ...(lista.precios || {}), [gtId]: +valor || 0 };
    try {
      await updateDocument('listasPrecios', listaId, { precios });
    } catch { toast.error('Error al guardar precio'); }
  };

  const eliminarLista = async (lista) => {
    if (!window.confirm(`¿Eliminar la lista "${lista.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await updateDocument('listasPrecios', lista.id, { active: false, eliminado: true });
      toast.success('Lista eliminada');
      setVista('inicio');
    } catch { toast.error('Error'); }
  };

  // ── INICIO ──────────────────────────────────────────────────────────────────
  if (vista === 'inicio') {
    const listasActivas = listas.filter(l => l.active !== false && !l.eliminado);
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-sm font-bold text-gray-900">Listas de Precios</h1>
          {isAdmin && (
            <button onClick={() => { setShowNew(true); setEditLista(null); setForm({ nombre:'', descripcion:'' }); }}
              className="text-xs font-bold px-4 py-2 rounded-lg text-white"
              style={{ background: ACCENT }}>
              + Nueva Lista
            </button>
          )}
        </div>

        {listasActivas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
            <p className="text-4xl mb-3">💰</p>
            <p className="font-medium text-gray-700">Sin listas de precios</p>
            <p className="text-sm text-gray-400 mt-1">Crea una lista para asignarla a facturas de clientes</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listasActivas.map(lista => (
            <div key={lista.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-orange-200 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{lista.nombre}</p>
                  {lista.descripcion && <p className="text-xs text-gray-400 mt-0.5">{lista.descripcion}</p>}
                </div>
                <span className="text-2xl">💰</span>
              </div>
              <div className="space-y-1 mb-3">
                {GARMENT_TYPES.map(g => (
                  <div key={g.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{g.name}</span>
                    <span className="font-bold text-gray-900">{fmtM(lista.precios?.[g.id] || 0)}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setVista(lista.id)}
                  className="flex-1 text-xs font-bold py-1.5 rounded-lg text-white"
                  style={{ background: ACCENT }}>
                  ✏️ Editar precios
                </button>
                {isAdmin && (
                  <button onClick={() => eliminarLista(lista)}
                    className="text-xs py-1.5 px-3 rounded-lg bg-red-100 text-red-700 font-medium hover:bg-red-200">
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal nueva lista */}
        {showNew && (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:400}}>
              <h2 className="text-sm font-bold text-gray-900 mb-4">
                {editLista ? 'Editar Lista' : 'Nueva Lista de Precios'}
              </h2>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
                <input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}
                  placeholder="Ej: Lista General, Gobierno, Empresas..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
                <input value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))}
                  placeholder="Opcional: clientes del sector público..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowNew(false); setEditLista(null); }}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
                <button onClick={crearLista} disabled={saving}
                  className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: ACCENT }}>
                  {saving ? 'Guardando...' : editLista ? 'Actualizar' : 'Crear Lista'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── DETALLE LISTA — editar precios ──────────────────────────────────────────
  if (listaActual) {
    return (
      <div>
        <button onClick={() => setVista('inicio')} className="text-xs text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">← Listas de precios</button>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-sm font-bold text-gray-900">{listaActual.nombre}</h1>
            {listaActual.descripcion && <p className="text-xs text-gray-400">{listaActual.descripcion}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditLista(listaActual); setForm({ nombre: listaActual.nombre, descripcion: listaActual.descripcion||'' }); setShowNew(true); }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              ✏️ Editar nombre
            </button>
            <button onClick={() => eliminarLista(listaActual)}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-medium">
              🗑 Eliminar lista
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100" style={{ background: '#1a3a6b' }}>
            <p className="text-[10px] font-bold text-white uppercase tracking-wider">Precios por referencia</p>
          </div>
          <div className="p-4 space-y-3">
            {GARMENT_TYPES.map(g => (
              <div key={g.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800">{g.name}</p>
                  <p className="text-[10px] text-gray-400">{g.g === 'H' ? 'Hombre' : 'Mujer'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">$</span>
                  <input
                    type="number"
                    min={0}
                    defaultValue={listaActual.precios?.[g.id] || 0}
                    onBlur={e => updatePrecio(listaActual.id, g.id, e.target.value)}
                    className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-right focus:outline-none focus:border-orange-400"
                    style={{ color: '#1a3a6b' }}
                  />
                </div>
                <div className="text-right w-24">
                  <p className="text-sm font-black" style={{ color: ACCENT }}>
                    {fmtM(listaActual.precios?.[g.id] || 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">💡 Los precios se guardan automáticamente al salir de cada campo</p>
          </div>
        </div>

        {/* Modal editar nombre */}
        {showNew && editLista && (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:400}}>
              <h2 className="text-sm font-bold text-gray-900 mb-4">Editar Lista</h2>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
                <input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
                <input value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowNew(false); setEditLista(null); }}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
                <button onClick={crearLista} disabled={saving}
                  className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: ACCENT }}>
                  {saving ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
