import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument } from '../services/db';
import { ACCENT } from '../constants';
import { Modal, EmptyState } from '../components/ui';
import { fmtM } from '../utils';
import toast from 'react-hot-toast';

const emptyForm = () => ({
  name: '', city: '', address: '', phone: '',
  adminName: '', adminCedula: '', adminPhone: '', adminEmail: '',
  cap: '', notas: '',
  incentivos: [],
});

export default function GestionSatelitesScreen() {
  const { satellites, users, lots } = useData();
  const [showModal,  setShowModal]  = useState(false);
  const [showIncent, setShowIncent] = useState(null);
  const [editSat,    setEditSat]    = useState(null);
  const [form,       setForm]       = useState(emptyForm());
  const [saving,     setSaving]     = useState(false);
  const [incentForm, setIncentForm] = useState({ nombre:'', valor:'', descripcion:'' });

  const openNew  = () => { setEditSat(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (s) => {
    setEditSat(s);
    setForm({
      name:         s.name || '',
      city:         s.city || '',
      address:      s.address || '',
      phone:        s.phone || '',
      adminName:    s.adminName || '',
      adminCedula:  s.adminCedula || '',
      adminPhone:   s.adminPhone || '',
      adminEmail:   s.adminEmail || '',
      cap:          s.cap || '',
      notas:        s.notas || '',
      incentivos:   s.incentivos || [],
    });
    setShowModal(true);
  };

  const saveSatelite = async () => {
    if (!form.name || !form.city) { toast.error('Nombre y ciudad son obligatorios'); return; }
    setSaving(true);
    try {
      const data = {
        name:        form.name.trim(),
        city:        form.city.trim(),
        address:     form.address.trim(),
        phone:       form.phone.trim(),
        adminName:   form.adminName.trim(),
        adminCedula: form.adminCedula.trim(),
        adminPhone:  form.adminPhone.trim(),
        adminEmail:  form.adminEmail.trim(),
        cap:         form.cap ? +form.cap : null,
        notas:       form.notas.trim(),
        active:      true,
      };
      if (editSat) {
        await updateDocument('satellites', editSat.id, data);
        toast.success('✅ Satélite actualizado');
      } else {
        await addDocument('satellites', data);
        toast.success('✅ Satélite creado');
      }
      setShowModal(false);
    } catch(e) { console.error(e); toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (s) => {
    try {
      await updateDocument('satellites', s.id, { active: !s.active });
      toast.success(s.active ? 'Satélite desactivado' : 'Satélite activado');
    } catch { toast.error('Error'); }
  };

  const addIncentivo = async (satId) => {
    if (!incentForm.nombre || !incentForm.valor) { toast.error('Completa nombre y valor'); return; }
    try {
      const sat = satellites.find(s => s.id === satId);
      const incentivos = [...(sat.incentivos || []), {
        ...incentForm, valor: +incentForm.valor,
        fecha: new Date().toISOString().split('T')[0],
        id: Date.now().toString(),
      }];
      await updateDocument('satellites', satId, { incentivos });
      toast.success('✅ Incentivo registrado');
      setShowIncent(null);
      setIncentForm({ nombre:'', valor:'', descripcion:'' });
    } catch { toast.error('Error'); }
  };

  const getSatStats = (satId) => {
    const satLots = lots.filter(l => l.satId === satId);
    const active  = satLots.filter(l => l.status === 'costura').length;
    const done    = satLots.filter(l => !['nuevo','recibido_alistamiento','en_corte','entregar_admin','asignacion'].includes(l.status)).length;
    const workers = users.filter(u => u.satId === satId && u.role === 'operario').length;
    return { active, done, workers };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-gray-900">Satélites</h1>
        <button onClick={openNew}
          className="px-4 py-2 text-white rounded-lg text-xs font-bold"
          style={{ background: ACCENT }}>
          + Nuevo Satélite
        </button>
      </div>

      {satellites.length === 0 && <EmptyState emoji="🏭" title="Sin satélites" sub="Agrega satélites usando el botón de arriba" />}

      <div className="space-y-3">
        {satellites.map(sat => {
          const stats = getSatStats(sat.id);
          const totalIncentivos = (sat.incentivos||[]).reduce((a,i)=>a+i.valor,0);
          return (
            <div key={sat.id} className="bg-white rounded-xl border border-gray-100 p-4"
              style={{ opacity: sat.active === false ? 0.6 : 1 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">🏭</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{sat.name}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${sat.active!==false?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>
                        {sat.active!==false?'Activo':'Inactivo'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500">{sat.city}{sat.address?` · ${sat.address}`:''}</p>
                    {sat.phone && <p className="text-[10px] text-gray-400">{sat.phone}</p>}
                    {sat.adminName && (
                      <p className="text-[10px] text-blue-600 mt-0.5">
                        Admin: <strong>{sat.adminName}</strong>
                        {sat.adminCedula ? ` · CC: ${sat.adminCedula}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex gap-2 text-center">
                    <div><p className="text-base font-black text-blue-700">{stats.active}</p><p className="text-[9px] text-gray-400">Activos</p></div>
                    <div><p className="text-base font-black text-green-600">{stats.done}</p><p className="text-[9px] text-gray-400">Listos</p></div>
                    <div><p className="text-base font-black text-purple-600">{stats.workers}</p><p className="text-[9px] text-gray-400">Ops</p></div>
                  </div>
                  {totalIncentivos > 0 && <p className="text-[9px] text-amber-600 font-bold mt-1">⭐ {fmtM(totalIncentivos)}</p>}
                </div>
              </div>

              {/* Incentivos */}
              {sat.incentivos?.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-2">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Incentivos</p>
                  <div className="space-y-1">
                    {sat.incentivos.slice(-2).map((inc,i) => (
                      <div key={i} className="flex items-center justify-between text-[10px] bg-amber-50 rounded-lg px-2 py-1">
                        <span className="text-amber-800 font-medium">⭐ {inc.nombre}</span>
                        <span className="text-amber-700 font-bold">{fmtM(inc.valor)}</span>
                        <span className="text-gray-400">{inc.fecha}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2 mt-3">
                <button onClick={() => openEdit(sat)}
                  className="flex-1 text-[10px] py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                  ✏️ Editar
                </button>
                <button onClick={() => setShowIncent(sat.id)}
                  className="flex-1 text-[10px] py-1.5 bg-amber-50 text-amber-700 rounded-lg font-medium hover:bg-amber-100">
                  ⭐ Incentivo
                </button>
                <button onClick={() => toggleActive(sat)}
                  className={`text-[10px] py-1.5 px-2 rounded-lg font-medium ${sat.active!==false?'bg-green-50 text-green-700':'bg-red-50 text-red-600'}`}>
                  {sat.active!==false?'Desactivar':'Activar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MODAL CREAR/EDITAR SATÉLITE ── */}
      {showModal && (
        <Modal title={editSat ? 'Editar Satélite' : 'Nuevo Satélite'} onClose={() => setShowModal(false)} wide>

          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Datos del taller</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre del taller *</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                placeholder="Ej: Confecciones García" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Ciudad *</label>
              <input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}
                placeholder="Bogotá" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Dirección</label>
              <input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}
                placeholder="Calle 10 # 5-20" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Teléfono</label>
              <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
                placeholder="310-555-0000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Admin responsable del taller</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre completo</label>
              <input value={form.adminName} onChange={e=>setForm(f=>({...f,adminName:e.target.value}))}
                placeholder="María García" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cédula</label>
              <input value={form.adminCedula} onChange={e=>setForm(f=>({...f,adminCedula:e.target.value}))}
                placeholder="52.123.456" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Teléfono admin</label>
              <input value={form.adminPhone} onChange={e=>setForm(f=>({...f,adminPhone:e.target.value}))}
                placeholder="315-555-0000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email admin</label>
              <input value={form.adminEmail} onChange={e=>setForm(f=>({...f,adminEmail:e.target.value}))}
                placeholder="maria@taller.com" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Capacidad (prendas/semana)</label>
              <input type="number" value={form.cap} onChange={e=>setForm(f=>({...f,cap:e.target.value}))}
                placeholder="500" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notas internas</label>
            <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
              placeholder="Observaciones, condiciones especiales, acuerdos..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-14 focus:outline-none" />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowModal(false)}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
            <button onClick={saveSatelite} disabled={saving}
              className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: ACCENT }}>
              {saving ? 'Guardando...' : editSat ? 'Actualizar Satélite' : 'Crear Satélite'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── MODAL INCENTIVO SATÉLITE ── */}
      {showIncent && (
        <Modal title="Incentivo al Satélite" onClose={() => setShowIncent(null)}>
          {(() => {
            const sat = satellites.find(s => s.id === showIncent);
            return (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  <p className="text-xs font-bold text-amber-800">🏭 {sat?.name}</p>
                  <p className="text-[10px] text-amber-600">{sat?.city}</p>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre del incentivo *</label>
                  <input value={incentForm.nombre} onChange={e=>setIncentForm(f=>({...f,nombre:e.target.value}))}
                    placeholder="Ej: Entrega a tiempo 3 semanas seguidas..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Valor ($) *</label>
                  <input type="number" value={incentForm.valor} onChange={e=>setIncentForm(f=>({...f,valor:e.target.value}))}
                    placeholder="100.000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
                  <textarea value={incentForm.descripcion} onChange={e=>setIncentForm(f=>({...f,descripcion:e.target.value}))}
                    placeholder="Detalle del logro o reto cumplido..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:border-amber-400" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowIncent(null)}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
                  <button onClick={() => addIncentivo(showIncent)}
                    className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold"
                    style={{ background: '#d97706' }}>
                    ⭐ Registrar Incentivo
                  </button>
                </div>
              </>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
