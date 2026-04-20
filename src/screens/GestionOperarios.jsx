import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument } from '../services/db';
import { ROLE_META, ACCENT } from '../constants';
import { Modal, EmptyState } from '../components/ui';
import { fmtM, workerQuincena, getOpVal } from '../utils';
import toast from 'react-hot-toast';

const ROLES_INTERNOS = ['corte','bodega_op','terminacion','tintoreria','despachos','nomina'];

export default function GestionOperariosScreen() {
  const { users, lots, ops, satOpVals } = useData();
  const [showNew,   setShowNew]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [filterRol, setFilterRol] = useState('all');
  const [form, setForm] = useState({
    cedula: '', nombre: '', apellido: '', role: 'terminacion', email: '', telefono: '',
  });

  // Only ELROHI internal workers
  const internalUsers = users.filter(u =>
    ['corte','bodega_op','terminacion','tintoreria','despachos','nomina','pespunte'].includes(u.role)
  );
  const filtered = filterRol === 'all' ? internalUsers : internalUsers.filter(u => u.role === filterRol);

  const createOperario = async () => {
    if (!form.cedula || !form.nombre || !form.apellido) {
      toast.error('Cédula, nombre y apellido son obligatorios');
      return;
    }
    // Check unique cedula
    if (users.find(u => u.cedula === form.cedula)) {
      toast.error('Ya existe un operario con esa cédula');
      return;
    }
    setSaving(true);
    try {
      await addDocument('users', {
        cedula:   form.cedula,
        name:     `${form.nombre} ${form.apellido}`,
        nombre:   form.nombre,
        apellido: form.apellido,
        role:     form.role,
        email:    form.email || `${form.cedula}@elrohi.com`,
        telefono: form.telefono,
        satId:    null,
        initials: `${form.nombre[0]}${form.apellido[0]}`.toUpperCase(),
        active:   true,
      });
      toast.success('✅ Operario creado');
      setShowNew(false);
      setForm({ cedula: '', nombre: '', apellido: '', role: 'terminacion', email: '', telefono: '' });
    } catch(e) { console.error(e); toast.error('Error al crear'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (user) => {
    try {
      await updateDocument('users', user.id, { active: !user.active });
      toast.success(user.active ? 'Operario desactivado' : 'Operario activado');
    } catch { toast.error('Error'); }
  };

  const getQuincena = (userId) => {
    // Sum from both lot operations (satellite) and opsElrohi (internal)
    const fromSat = workerQuincena(userId, lots, ops, satOpVals);
    const fromElrohi = lots.reduce((total, lot) => {
      if (!lot.opsElrohi) return total;
      return total + lot.opsElrohi.reduce((t2, op) => {
        const myComp = (op.assignments || []).filter(a => a.operarioId === userId && a.status === 'completado');
        return t2 + myComp.reduce((t3, a) => t3 + (op.val || 0) * a.qty, 0);
      }, 0);
    }, 0);
    return fromSat + fromElrohi;
  };

  const rolOptions = [
    ['all', 'Todos los roles'],
    ['corte', 'Corte'],
    ['bodega_op', 'Bodega'],
    ['terminacion', 'Terminación'],
    ['tintoreria', 'Tintorería'],
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-gray-900">Operarios ELROHI</h1>
        <button onClick={() => setShowNew(true)}
          className="px-4 py-2 text-white rounded-lg text-xs font-bold"
          style={{ background: ACCENT }}>
          + Nuevo Operario
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {rolOptions.map(([k, l]) => (
          <button key={k} onClick={() => setFilterRol(k)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium border-none cursor-pointer"
            style={{ background: filterRol === k ? ACCENT : '#f1f0ec', color: filterRol === k ? '#fff' : '#6b7280' }}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <EmptyState emoji="👥" title="Sin operarios" sub="Agrega operarios usando el botón de arriba" />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(u => {
          const quincena = getQuincena(u.id);
          const meta     = ROLE_META[u.role] || { label: u.role, badge: 'bg-gray-100 text-gray-600' };
          return (
            <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-4" style={{ opacity: u.active === false ? 0.6 : 1 }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                    {u.initials || u.name?.slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{u.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`${meta.badge} text-[9px] px-2 py-0.5 rounded-full font-medium`}>{meta.label}</span>
                      {u.cedula && <span className="text-[9px] text-gray-400 font-mono">CC: {u.cedula}</span>}
                    </div>
                    {u.telefono && <p className="text-[10px] text-gray-400 mt-0.5">{u.telefono}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-gray-400">Quincena</p>
                  <p className="text-sm font-black text-green-600">{fmtM(quincena)}</p>
                  <button onClick={() => toggleActive(u)}
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold mt-1 border-none cursor-pointer ${u.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {u.active !== false ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal nuevo operario */}
      {showNew && (
        <Modal title="Nuevo Operario ELROHI" onClose={() => setShowNew(false)}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cédula *</label>
              <input value={form.cedula} onChange={e => setForm(f => ({ ...f, cedula: e.target.value }))}
                placeholder="1.234.567.890" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Rol principal *</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
                <option value="terminacion">Terminación</option>
                <option value="bodega_op">Bodega</option>
                <option value="corte">Corte</option>
                <option value="tintoreria">Tintorería</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Carlos" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Apellido *</label>
              <input value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                placeholder="Rodríguez" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                placeholder="310-555-0000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email (opcional)</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="usuario@elrohi.com" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 mb-4 text-xs text-blue-700">
            💡 El operario podrá realizar cualquier operación del sistema sin importar su rol principal. El rol principal es solo para referencia organizacional.
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowNew(false)}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
            <button onClick={createOperario} disabled={saving}
              className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: ACCENT }}>
              {saving ? 'Guardando...' : 'Crear Operario'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
