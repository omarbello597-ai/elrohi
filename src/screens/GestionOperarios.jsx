import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument } from '../services/db';
import { ROLE_META, ACCENT } from '../constants';
import { Modal, EmptyState } from '../components/ui';
import { fmtM } from '../utils';
import toast from 'react-hot-toast';

const ROLES_INTERNOS = [
  { value: 'terminacion', label: 'Terminación'  },
  { value: 'bodega_op',   label: 'Bodega'        },
  { value: 'corte',       label: 'Corte'         },
  { value: 'tintoreria',  label: 'Tintorería'    },
  { value: 'despachos',   label: 'Despachos'     },
  { value: 'nomina',      label: 'Nómina'        },
];

const SALARY_TYPES = [
  { value: 'solo_operaciones', label: 'Solo por operaciones'            },
  { value: 'fijo_mas_ops',     label: 'Salario fijo + operaciones'      },
  { value: 'solo_fijo',        label: 'Solo salario fijo'               },
];

const emptyForm = () => ({
  nombre: '', apellido: '', cedula: '', role: 'terminacion',
  telefono: '', email: '',
  salarioTipo: 'solo_operaciones',
  salarioFijo: '',
  notas: '',
});

export default function GestionOperariosScreen() {
  const { users, lots, ops, satOpVals } = useData();
  const [showModal, setShowModal]   = useState(false);
  const [showIncent, setShowIncent] = useState(null);
  const [editUser,  setEditUser]    = useState(null);
  const [form,      setForm]        = useState(emptyForm());
  const [filterRol, setFilterRol]   = useState('all');
  const [saving,    setSaving]      = useState(false);
  const [incentForm, setIncentForm] = useState({ nombre:'', valor:'', descripcion:'' });

  const internalUsers = users.filter(u =>
    ['corte','bodega_op','terminacion','tintoreria','despachos','nomina','pespunte'].includes(u.role)
  );
  const filtered = filterRol === 'all' ? internalUsers : internalUsers.filter(u => u.role === filterRol);

  const openNew  = () => { setEditUser(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (u) => {
    setEditUser(u);
    setForm({
      nombre:      u.nombre || u.name?.split(' ')[0] || '',
      apellido:    u.apellido || u.name?.split(' ').slice(1).join(' ') || '',
      cedula:      u.cedula || '',
      role:        u.role || 'terminacion',
      telefono:    u.telefono || '',
      email:       u.email || '',
      salarioTipo: u.salarioTipo || 'solo_operaciones',
      salarioFijo: u.salarioFijo || '',
      notas:       u.notas || '',
    });
    setShowModal(true);
  };

  const saveOperario = async () => {
    if (!form.cedula || !form.nombre || !form.apellido) {
      toast.error('Cédula, nombre y apellido son obligatorios');
      return;
    }
    if (!editUser && users.find(u => u.cedula === form.cedula)) {
      toast.error('Ya existe un operario con esa cédula');
      return;
    }
    setSaving(true);
    try {
      const data = {
        cedula:      form.cedula.trim(),
        nombre:      form.nombre.trim(),
        apellido:    form.apellido.trim(),
        name:        `${form.nombre.trim()} ${form.apellido.trim()}`,
        initials:    `${form.nombre.trim()[0]}${form.apellido.trim()[0]}`.toUpperCase(),
        role:        form.role,
        email:       form.email.trim() || `${form.cedula.trim()}@elrohi.com`,
        telefono:    form.telefono.trim(),
        salarioTipo: form.salarioTipo,
        salarioFijo: form.salarioFijo ? +form.salarioFijo : null,
        notas:       form.notas.trim(),
        satId:       null,
        active:      true,
      };
      if (editUser) {
        await updateDocument('users', editUser.id, data);
        toast.success('✅ Operario actualizado');
      } else {
        await addDocument('users', data);
        toast.success('✅ Operario creado');
      }
      setShowModal(false);
    } catch(e) { console.error(e); toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (u) => {
    try {
      await updateDocument('users', u.id, { active: !u.active });
      toast.success(u.active ? 'Operario desactivado' : 'Operario activado');
    } catch { toast.error('Error'); }
  };

  const addIncentivo = async (userId) => {
    if (!incentForm.nombre || !incentForm.valor) {
      toast.error('Completa nombre y valor del incentivo');
      return;
    }
    try {
      const user = users.find(u => u.id === userId);
      const incentivos = [...(user.incentivos || []), {
        ...incentForm,
        valor: +incentForm.valor,
        fecha: new Date().toISOString().split('T')[0],
        id: Date.now().toString(),
      }];
      await updateDocument('users', userId, { incentivos });
      toast.success('✅ Incentivo registrado');
      setShowIncent(null);
      setIncentForm({ nombre:'', valor:'', descripcion:'' });
    } catch { toast.error('Error'); }
  };

  const getQuincena = (userId) => {
    return lots.reduce((total, lot) => {
      if (!lot.opsElrohi) return total;
      return total + lot.opsElrohi.reduce((t2, op) => {
        const myComp = (op.assignments || []).filter(a => a.operarioId === userId && a.status === 'completado');
        return t2 + myComp.reduce((t3, a) => t3 + (op.val || 0) * a.qty, 0);
      }, 0);
    }, 0);
  };

  const rolOptions = [
    ['all','Todos'],
    ['corte','Corte'],
    ['bodega_op','Bodega'],
    ['terminacion','Terminación'],
    ['tintoreria','Tintorería'],
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-gray-900">Operarios ELROHI</h1>
        <button onClick={openNew}
          className="px-4 py-2 text-white rounded-lg text-xs font-bold"
          style={{ background: ACCENT }}>
          + Nuevo Operario
        </button>
      </div>

      {/* Filtros por rol */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {rolOptions.map(([k,l]) => (
          <button key={k} onClick={() => setFilterRol(k)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium border-none cursor-pointer"
            style={{ background: filterRol===k?ACCENT:'#f1f0ec', color: filterRol===k?'#fff':'#6b7280' }}>
            {l} {k!=='all' && `(${internalUsers.filter(u=>u.role===k).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <EmptyState emoji="👥" title="Sin operarios" sub="Agrega operarios usando el botón de arriba" />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(u => {
          const quincena = getQuincena(u.id);
          const meta = ROLE_META[u.role] || { label: u.role, badge: 'bg-gray-100 text-gray-600' };
          const salLabel = u.salarioTipo === 'fijo_mas_ops' ? `Fijo ${fmtM(u.salarioFijo||0)} + ops`
            : u.salarioTipo === 'solo_fijo' ? `Fijo ${fmtM(u.salarioFijo||0)}`
            : 'Por operaciones';
          const totalIncentivos = (u.incentivos||[]).reduce((a,i)=>a+i.valor,0);

          return (
            <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-4"
              style={{ opacity: u.active === false ? 0.55 : 1 }}>

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                    {u.initials || u.name?.slice(0,2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{u.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`${meta.badge} text-[9px] px-1.5 py-0.5 rounded-full font-medium`}>{meta.label}</span>
                      {u.cedula && <span className="text-[9px] text-gray-400 font-mono">CC: {u.cedula}</span>}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{salLabel}</p>
                    {u.telefono && <p className="text-[10px] text-gray-400">{u.telefono}</p>}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-[9px] text-gray-400">Quincena</p>
                  <p className="text-sm font-black text-green-600">{fmtM(quincena)}</p>
                  {totalIncentivos > 0 && (
                    <p className="text-[9px] text-amber-600 font-bold">+{fmtM(totalIncentivos)} incentivos</p>
                  )}
                </div>
              </div>

              {/* Incentivos */}
              {u.incentivos?.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-2">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Incentivos registrados</p>
                  <div className="space-y-1">
                    {u.incentivos.slice(-3).map((inc,i) => (
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
                <button onClick={() => openEdit(u)}
                  className="flex-1 text-[10px] py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                  ✏️ Editar
                </button>
                <button onClick={() => setShowIncent(u.id)}
                  className="flex-1 text-[10px] py-1.5 bg-amber-50 text-amber-700 rounded-lg font-medium hover:bg-amber-100">
                  ⭐ Incentivo
                </button>
                <button onClick={() => toggleActive(u)}
                  className={`text-[10px] py-1.5 px-2 rounded-lg font-medium ${u.active!==false?'bg-green-50 text-green-700 hover:bg-green-100':'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                  {u.active!==false?'Activo':'Inactivo'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MODAL CREAR/EDITAR OPERARIO ── */}
      {showModal && (
        <Modal title={editUser ? 'Editar Operario' : 'Nuevo Operario ELROHI'} onClose={() => setShowModal(false)} wide>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-xs text-blue-700">
            💡 El operario podrá realizar cualquier operación sin importar su rol principal. El rol es solo para referencia organizacional.
          </div>

          {/* Datos personales */}
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Datos personales</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}
                placeholder="Carlos" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Apellido *</label>
              <input value={form.apellido} onChange={e=>setForm(f=>({...f,apellido:e.target.value}))}
                placeholder="Rodríguez" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cédula *</label>
              <input value={form.cedula} onChange={e=>setForm(f=>({...f,cedula:e.target.value}))}
                placeholder="1.234.567.890" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))}
                placeholder="310-555-0000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
            <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
              placeholder="carlos@elrohi.com (opcional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>

          {/* Cargo y salario */}
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cargo y salario</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Rol / Cargo principal *</label>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
                {ROLES_INTERNOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de salario</label>
              <select value={form.salarioTipo} onChange={e=>setForm(f=>({...f,salarioTipo:e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
                {SALARY_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {(form.salarioTipo === 'fijo_mas_ops' || form.salarioTipo === 'solo_fijo') && (
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Salario fijo mensual ($) {form.salarioTipo === 'fijo_mas_ops' ? '+ lo que gane por operaciones' : ''}
              </label>
              <input type="number" value={form.salarioFijo} onChange={e=>setForm(f=>({...f,salarioFijo:e.target.value}))}
                placeholder="1.300.000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notas internas</label>
            <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
              placeholder="Habilidades especiales, observaciones..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-14 focus:outline-none focus:border-blue-400" />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowModal(false)}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
            <button onClick={saveOperario} disabled={saving}
              className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: ACCENT }}>
              {saving ? 'Guardando...' : editUser ? 'Actualizar Operario' : 'Crear Operario'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── MODAL INCENTIVO ── */}
      {showIncent && (
        <Modal title="Registrar Incentivo" onClose={() => setShowIncent(null)}>
          {(() => {
            const u = users.find(x => x.id === showIncent);
            return (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  <p className="text-xs font-bold text-amber-800">{u?.name}</p>
                  <p className="text-[10px] text-amber-600">{ROLE_META[u?.role]?.label || u?.role}</p>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre del incentivo *</label>
                  <input value={incentForm.nombre} onChange={e=>setIncentForm(f=>({...f,nombre:e.target.value}))}
                    placeholder="Ej: Meta semanal cumplida, Mejor operario del mes..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Valor ($) *</label>
                  <input type="number" value={incentForm.valor} onChange={e=>setIncentForm(f=>({...f,valor:e.target.value}))}
                    placeholder="50.000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
                  <textarea value={incentForm.descripcion} onChange={e=>setIncentForm(f=>({...f,descripcion:e.target.value}))}
                    placeholder="Describe el logro o razón del incentivo..."
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
