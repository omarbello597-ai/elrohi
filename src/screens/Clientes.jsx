import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { ACCENT } from '../constants';
import { orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';

const FORMAS_PAGO = [
  { value: 'contado',  label: 'Contado'  },
  { value: 'credito',  label: 'Crédito'  },
];

const IMPUESTOS = [
  { value: 'iva',                label: 'IVA 19%'            },
  { value: 'remision_mayorista', label: 'Remisión Mayorista' },
  { value: 'ninguno',            label: 'Sin impuestos'      },
];

const emptyForm = () => ({
  nombre: '', nit: '', direccion: '', telefono: '',
  ciudad: '', formaPago: 'contado', impuesto: 'ninguno', notas: '',
});

export default function ClientesScreen() {
  const { profile }  = useAuth();
  const [clientes, setClientes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editCliente, setEditCliente] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [busqueda, setBusqueda] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = listenCol('clients', setClientes, orderBy('nombre', 'asc'));
    return unsub;
  }, []);

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);

  const clientesFiltrados = busqueda
    ? clientes.filter(c =>
        c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.nit?.includes(busqueda) ||
        c.ciudad?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : clientes.filter(c => c.active !== false);

  const openNew = () => {
    setEditCliente(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditCliente(c);
    setForm({
      nombre:    c.nombre    || '',
      nit:       c.nit       || '',
      direccion: c.direccion || '',
      telefono:  c.telefono  || '',
      ciudad:    c.ciudad    || '',
      formaPago: c.formaPago || 'contado',
      impuesto:  c.impuesto  || 'ninguno',
      notas:     c.notas     || '',
    });
    setShowModal(true);
  };

  const guardar = async () => {
    if (!form.nombre) { toast.error('El nombre es obligatorio'); return; }
    if (!form.nit)    { toast.error('El NIT es obligatorio'); return; }
    setSaving(true);
    try {
      if (editCliente) {
        await updateDocument('clients', editCliente.id, { ...form });
        toast.success('✅ Cliente actualizado');
      } else {
        await addDocument('clients', { ...form, active: true });
        toast.success('✅ Cliente creado');
      }
      setShowModal(false);
    } catch(e) { console.error(e); toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const eliminar = async (cliente) => {
    if (!window.confirm(`¿Eliminar a ${cliente.nombre}? Sus facturas históricas quedarán guardadas.`)) return;
    try {
      await updateDocument('clients', cliente.id, { active: false, eliminado: true });
      toast.success('Cliente eliminado');
    } catch { toast.error('Error'); }
  };

  const impLabel  = (v) => IMPUESTOS.find(i=>i.value===v)?.label || v;
  const pagoLabel = (v) => FORMAS_PAGO.find(p=>p.value===v)?.label || v;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-sm font-bold text-gray-900">Clientes</h1>
          <p className="text-xs text-gray-400">{clientesFiltrados.length} clientes registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <span className="text-gray-400 text-sm">🔍</span>
            <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              placeholder="Buscar cliente..."
              className="text-xs outline-none bg-transparent w-36" />
            {busqueda && <button onClick={()=>setBusqueda('')} className="text-gray-400 text-xs">✕</button>}
          </div>
          {isAdmin && (
            <button onClick={openNew}
              className="text-xs font-bold px-4 py-2 rounded-lg text-white"
              style={{background:ACCENT}}>
              + Nuevo Cliente
            </button>
          )}
        </div>
      </div>

      {/* Lista de clientes */}
      {clientesFiltrados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-medium text-gray-700">
            {busqueda ? 'No se encontró ese cliente' : 'Sin clientes registrados'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {!busqueda && isAdmin && 'Agrega el primer cliente con el botón de arriba'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {clientesFiltrados.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-sm font-bold text-gray-900">{c.nombre}</p>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                    c.formaPago==='credito'?'bg-purple-100 text-purple-700':'bg-green-100 text-green-700'
                  }`}>
                    {pagoLabel(c.formaPago)}
                  </span>
                  <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                    {impLabel(c.impuesto)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] text-gray-500">
                  <span>NIT: <strong className="text-gray-700">{c.nit}</strong></span>
                  {c.ciudad && <span>📍 {c.ciudad}</span>}
                  {c.telefono && <span>📞 {c.telefono}</span>}
                </div>
                {c.direccion && <p className="text-[10px] text-gray-400 mt-0.5">📬 {c.direccion}</p>}
                {c.notas && <p className="text-[10px] text-gray-400 italic mt-0.5">"{c.notas}"</p>}
              </div>
              {isAdmin && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(c)}
                    className="text-[10px] px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                    ✏️ Editar
                  </button>
                  <button onClick={() => eliminar(c)}
                    className="text-[10px] px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200">
                    🗑
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL CREAR/EDITAR */}
      {showModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:16,overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:500,marginTop:16,marginBottom:16}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">
                {editCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <button onClick={()=>setShowModal(false)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre / Razón Social *</label>
                <input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}
                  placeholder="Empresa o persona natural"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>

              {/* NIT y Teléfono */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">NIT / Cédula *</label>
                  <input value={form.nit} onChange={e=>setForm(f=>({...f,nit:e.target.value}))}
                    placeholder="900.123.456-7"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono</label>
                  <input value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))}
                    placeholder="310 000 0000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>

              {/* Ciudad */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ciudad</label>
                <input value={form.ciudad} onChange={e=>setForm(f=>({...f,ciudad:e.target.value}))}
                  placeholder="Bogotá, Medellín, Cali..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Dirección</label>
                <input value={form.direccion} onChange={e=>setForm(f=>({...f,direccion:e.target.value}))}
                  placeholder="Calle 10 # 5-20"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>

              {/* Forma de pago e Impuesto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Forma de pago</label>
                  <select value={form.formaPago} onChange={e=>setForm(f=>({...f,formaPago:e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-400">
                    {FORMAS_PAGO.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Impuestos</label>
                  <select value={form.impuesto} onChange={e=>setForm(f=>({...f,impuesto:e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-400">
                    {IMPUESTOS.map(i=><option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
                <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
                  placeholder="Condiciones especiales, contacto, observaciones..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-16 focus:outline-none" />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">
                Cancelar
              </button>
              <button onClick={guardar} disabled={saving}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:ACCENT}}>
                {saving?'Guardando...':`${editCliente?'Actualizar':'Crear'} Cliente`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
