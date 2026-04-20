import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { updateDocument } from '../services/db';
import { ACCENT, OPS_ELROHI_DEFAULT } from '../constants';
import { Modal, Select, EmptyState, ProgressBar } from '../components/ui';
import { gLabel, cLabel, fmtM } from '../utils';
import toast from 'react-hot-toast';

const genOpId = () => 'op_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
const genAssId = () => 'ass_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

export default function OperacionesElrohiScreen() {
  const { profile }            = useAuth();
  const { lots, clients, users } = useData();
  const [selLotId, setSelLotId] = useState(null);
  const [showAddOp, setShowAddOp] = useState(false);
  const [showTakeOp, setShowTakeOp] = useState(null);
  const [showReasign, setShowReasign] = useState(null);
  const [saving, setSaving]    = useState(false);

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);
  const isOperario = ['corte','bodega_op','terminacion','pespunte'].includes(profile?.role) || isAdmin;

  // All internal ELROHI operarios
  const elrohiOps = users.filter(u => ['corte','bodega_op','terminacion','pespunte'].includes(u.role));

  // Lots in operaciones
  const opLots = lots.filter(l => ['en_operaciones','en_bodega_1','en_bodega_2'].includes(l.status));

  const selLot = lots.find(l => l.id === selLotId);

  // ─── ADD OPERATION ────────────────────────────────────────────────────────
  const [newOp, setNewOp] = useState({ name: '', val: '', totalQty: '', esEspecial: false, descripcion: '' });

  const addOperation = async () => {
    if (!newOp.name || !newOp.val || !newOp.totalQty) { toast.error('Completa todos los campos'); return; }
    setSaving(true);
    try {
      const op = {
        id:          genOpId(),
        name:        newOp.name,
        val:         +newOp.val,
        totalQty:    +newOp.totalQty,
        asignado:    0,
        completado:  0,
        esEspecial:  newOp.esEspecial,
        descripcion: newOp.descripcion,
        assignments: [],
      };
      const opsElrohi = [...(selLot.opsElrohi || []), op];
      await updateDocument('lots', selLot.id, { opsElrohi });
      toast.success('Operación agregada');
      setShowAddOp(false);
      setNewOp({ name: '', val: '', totalQty: '', esEspecial: false, descripcion: '' });
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  // ─── TAKE OPERATION (operario toma cantidad) ──────────────────────────────
  const [takeQty, setTakeQty] = useState('');

  const takeOperation = async (opId) => {
    if (!takeQty || +takeQty <= 0) { toast.error('Ingresa una cantidad válida'); return; }
    const op = selLot.opsElrohi?.find(o => o.id === opId);
    if (!op) return;
    const disponible = op.totalQty - op.asignado;
    if (+takeQty > disponible) { toast.error(`Solo hay ${disponible} piezas disponibles`); return; }
    setSaving(true);
    try {
      const assignment = {
        id:        genAssId(),
        operarioId: profile.id,
        operarioName: profile.name,
        qty:       +takeQty,
        status:    'en_proceso',
        taken:     new Date().toISOString().split('T')[0],
        done:      null,
      };
      const opsElrohi = selLot.opsElrohi.map(o =>
        o.id === opId
          ? { ...o, asignado: o.asignado + +takeQty, assignments: [...(o.assignments || []), assignment] }
          : o
      );
      await updateDocument('lots', selLot.id, { opsElrohi });
      toast.success(`✅ Tomaste ${takeQty} piezas de "${op.name}"`);
      setShowTakeOp(null);
      setTakeQty('');
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  // ─── COMPLETE ASSIGNMENT ──────────────────────────────────────────────────
  const completeAssignment = async (opId, assId) => {
    const op = selLot.opsElrohi?.find(o => o.id === opId);
    if (!op) return;
    const ass = op.assignments?.find(a => a.id === assId);
    if (!ass) return;
    try {
      const opsElrohi = selLot.opsElrohi.map(o =>
        o.id === opId ? {
          ...o,
          completado: o.completado + ass.qty,
          assignments: o.assignments.map(a =>
            a.id === assId ? { ...a, status: 'completado', done: new Date().toISOString().split('T')[0] } : a
          ),
        } : o
      );
      // Check if all ops complete
      const allDone = opsElrohi.every(o => o.completado >= o.totalQty);
      await updateDocument('lots', selLot.id, {
        opsElrohi,
        ...(allDone ? { status: 'despachado' } : {}),
      });
      toast.success('¡Operación completada!');
      if (allDone) toast.success('🎉 Todas las operaciones completas — lote listo para despacho');
    } catch { toast.error('Error'); }
  };

  // ─── REASIGN ──────────────────────────────────────────────────────────────
  const [reasignData, setReasignData] = useState({ qty: '', toOperarioId: '' });

  const reasign = async (opId, assId) => {
    if (!reasignData.qty || !reasignData.toOperarioId) { toast.error('Completa los campos'); return; }
    const op  = selLot.opsElrohi?.find(o => o.id === opId);
    const ass = op?.assignments?.find(a => a.id === assId);
    if (!ass || +reasignData.qty > ass.qty) { toast.error('Cantidad inválida'); return; }
    const toOp = elrohiOps.find(u => u.id === reasignData.toOperarioId);
    setSaving(true);
    try {
      const newQty = ass.qty - +reasignData.qty;
      const newAss = {
        id:           genAssId(),
        operarioId:   toOp.id,
        operarioName: toOp.name,
        qty:          +reasignData.qty,
        status:       'en_proceso',
        taken:        new Date().toISOString().split('T')[0],
        done:         null,
        reasignadoPor: profile.name,
      };
      const opsElrohi = selLot.opsElrohi.map(o =>
        o.id === opId ? {
          ...o,
          assignments: [
            ...o.assignments.map(a => a.id === assId ? { ...a, qty: newQty } : a).filter(a => a.qty > 0),
            newAss,
          ],
        } : o
      );
      await updateDocument('lots', selLot.id, { opsElrohi });
      toast.success(`${reasignData.qty} piezas reasignadas a ${toOp.name}`);
      setShowReasign(null);
      setReasignData({ qty: '', toOperarioId: '' });
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  const opProgress = (op) => op.totalQty > 0 ? Math.round(op.completado / op.totalQty * 100) : 0;

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Operaciones ELROHI</h1>

      {/* Selector de lote */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <label className="block text-xs font-semibold text-gray-600 mb-1">Seleccionar lote</label>
        <select value={selLotId || ''} onChange={e => setSelLotId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-purple-400">
          <option value="">— Seleccionar lote en operaciones —</option>
          {opLots.map(l => (
            <option key={l.id} value={l.id}>
              {l.code} · {cLabel(clients, l.clientId)} · {l.totalPieces?.toLocaleString('es-CO')} pzs
            </option>
          ))}
        </select>
      </div>

      {!selLot && opLots.length === 0 && (
        <EmptyState emoji="🪡" title="Sin lotes en operaciones" sub="Los lotes asignados desde Bodegas aparecerán aquí" />
      )}

      {selLot && (
        <div>
          {/* Header del lote */}
          <div className="bg-white rounded-xl border border-purple-200 p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-blue-700">{selLot.code}</span>
                <p className="text-sm font-bold text-gray-900">{cLabel(clients, selLot.clientId)}</p>
                <p className="text-[10px] text-gray-400">
                  {[...new Set(selLot.garments?.map(g => gLabel(g.gtId)))].join(', ')}
                  {' · '}{selLot.totalPieces?.toLocaleString('es-CO')} piezas
                </p>
              </div>
              {isAdmin && (
                <button onClick={() => setShowAddOp(true)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                  style={{ background: ACCENT }}>
                  + Agregar Operación
                </button>
              )}
            </div>
          </div>

          {/* Operaciones */}
          {(!selLot.opsElrohi || selLot.opsElrohi.length === 0) ? (
            <EmptyState emoji="⚙" title="Sin operaciones" sub={isAdmin ? "Agrega operaciones usando el botón de arriba" : "El admin aún no ha asignado operaciones"} />
          ) : (
            <div className="space-y-3">
              {selLot.opsElrohi.map(op => {
                const prog     = opProgress(op);
                const disp     = op.totalQty - op.asignado;
                const myAss    = op.assignments?.filter(a => a.operarioId === profile?.id && a.status === 'en_proceso') || [];
                const canTake  = isOperario && disp > 0;

                return (
                  <div key={op.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {/* Op header */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{op.name}</span>
                            {op.esEspecial && (
                              <span className="text-[9px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold">⭐ Especial</span>
                            )}
                          </div>
                          {op.descripcion && <p className="text-[10px] text-gray-400 mt-0.5">{op.descripcion}</p>}
                          <div className="flex gap-3 text-[10px] text-gray-500 mt-1">
                            <span>Total: <strong>{op.totalQty}</strong> pzs</span>
                            <span>Asignado: <strong>{op.asignado}</strong></span>
                            <span>Completado: <strong style={{ color: '#10b981' }}>{op.completado}</strong></span>
                            <span>Disponible: <strong style={{ color: disp > 0 ? '#1d4ed8' : '#9ca3af' }}>{disp}</strong></span>
                            <span>Valor: <strong>{fmtM(op.val)}/pza</strong></span>
                          </div>
                        </div>
                        {canTake && (
                          <button onClick={() => { setShowTakeOp(op.id); setTakeQty(''); }}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0"
                            style={{ background: '#7c3aed' }}>
                            Tomar piezas
                          </button>
                        )}
                      </div>
                      <ProgressBar value={prog} color={prog === 100 ? 'bg-green-500' : 'bg-purple-500'} />
                      <p className="text-[9px] text-right text-gray-400 mt-1">{prog}% completado</p>
                    </div>

                    {/* Assignments */}
                    {op.assignments?.length > 0 && (
                      <div className="divide-y divide-gray-50">
                        {op.assignments.map(ass => {
                          const isMe = ass.operarioId === profile?.id;
                          const valTot = op.val * ass.qty;
                          return (
                            <div key={ass.id} className="flex items-center gap-3 px-4 py-2.5 text-xs"
                              style={{ background: isMe ? '#faf5ff' : '#fff' }}>
                              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-700 flex-shrink-0">
                                {ass.operarioName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-800">{ass.operarioName}</p>
                                <p className="text-[10px] text-gray-400">
                                  {ass.qty} pzas · {fmtM(valTot)}
                                  {ass.reasignadoPor && ` · Reasignado por ${ass.reasignadoPor}`}
                                </p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${ass.status === 'completado' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {ass.status === 'completado' ? '✓ Listo' : '⚡ Activo'}
                              </span>

                              {/* Actions */}
                              {isMe && ass.status === 'en_proceso' && (
                                <div className="flex gap-1.5">
                                  <button onClick={() => completeAssignment(op.id, ass.id)}
                                    className="text-[9px] px-2 py-0.5 bg-green-100 text-green-700 rounded font-bold hover:bg-green-200">
                                    ✓ Terminé
                                  </button>
                                  <button onClick={() => { setShowReasign({ opId: op.id, assId: ass.id, maxQty: ass.qty }); setReasignData({ qty: '', toOperarioId: '' }); }}
                                    className="text-[9px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-bold hover:bg-amber-200">
                                    ↩ Reasignar
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal agregar operación */}
      {showAddOp && selLot && (
        <Modal title="Agregar Operación al Lote" onClose={() => setShowAddOp(false)}>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre de la operación</label>
            <div className="flex gap-2 mb-2">
              {OPS_ELROHI_DEFAULT.filter(o => o.active).map(o => (
                <button key={o.id} onClick={() => setNewOp(f => ({ ...f, name: o.name, val: String(o.val) }))}
                  className="text-[10px] px-2 py-1 bg-purple-50 text-purple-700 rounded border border-purple-200 hover:bg-purple-100">
                  {o.name}
                </button>
              ))}
            </div>
            <input value={newOp.name} onChange={e => setNewOp(f => ({ ...f, name: e.target.value }))}
              placeholder="O escribe el nombre..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Valor por pieza ($)</label>
              <input type="number" value={newOp.val} onChange={e => setNewOp(f => ({ ...f, val: e.target.value }))}
                placeholder="400"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Total de piezas</label>
              <input type="number" value={newOp.totalQty} onChange={e => setNewOp(f => ({ ...f, totalQty: e.target.value }))}
                placeholder={selLot.totalPieces?.toString()}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
            </div>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <input type="checkbox" id="especial" checked={newOp.esEspecial}
              onChange={e => setNewOp(f => ({ ...f, esEspecial: e.target.checked }))} />
            <label htmlFor="especial" className="text-xs font-medium text-gray-700">Operación especial</label>
          </div>
          {newOp.esEspecial && (
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción especial</label>
              <input value={newOp.descripcion} onChange={e => setNewOp(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Pegar reflectivo camisa XL"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400" />
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowAddOp(false)}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
            <button onClick={addOperation} disabled={saving}
              className="flex-1 py-2 text-white rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: '#7c3aed' }}>
              {saving ? 'Guardando...' : '+ Agregar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal tomar piezas */}
      {showTakeOp && selLot && (
        <Modal title="Tomar piezas para trabajar" onClose={() => setShowTakeOp(null)}>
          {(() => {
            const op = selLot.opsElrohi?.find(o => o.id === showTakeOp);
            const disp = (op?.totalQty || 0) - (op?.asignado || 0);
            return (
              <>
                <div className="bg-purple-50 rounded-xl p-3 mb-4">
                  <p className="text-xs font-bold text-purple-700">{op?.name}</p>
                  <p className="text-[10px] text-purple-600">Disponibles: <strong>{disp} piezas</strong> · Valor: <strong>{fmtM(op?.val)}/pza</strong></p>
                </div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">¿Cuántas piezas vas a tomar?</label>
                <input type="number" min={1} max={disp} value={takeQty} onChange={e => setTakeQty(e.target.value)}
                  placeholder={`Máximo ${disp}`} autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-purple-400" />
                {takeQty && +takeQty > 0 && (
                  <p className="text-xs text-green-700 bg-green-50 rounded px-3 py-2 mb-3">
                    Ganarás: <strong>{fmtM((op?.val || 0) * +takeQty)}</strong> al completar
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setShowTakeOp(null)}
                    className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
                  <button onClick={() => takeOperation(showTakeOp)} disabled={saving}
                    className="flex-1 py-2 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                    style={{ background: '#7c3aed' }}>
                    {saving ? 'Tomando...' : '✓ Tomar piezas'}
                  </button>
                </div>
              </>
            );
          })()}
        </Modal>
      )}

      {/* Modal reasignar */}
      {showReasign && selLot && (
        <Modal title="Reasignar piezas a otro operario" onClose={() => setShowReasign(null)}>
          {(() => {
            const { opId, assId, maxQty } = showReasign;
            return (
              <>
                <div className="bg-amber-50 rounded-xl p-3 mb-4 text-xs text-amber-700">
                  Puedes reasignar hasta <strong>{maxQty} piezas</strong> de tu trabajo actual a otro operario.
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">¿Cuántas piezas reasignar?</label>
                  <input type="number" min={1} max={maxQty} value={reasignData.qty}
                    onChange={e => setReasignData(f => ({ ...f, qty: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Asignar a:</label>
                  <select value={reasignData.toOperarioId} onChange={e => setReasignData(f => ({ ...f, toOperarioId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">— Elegir operario —</option>
                    {elrohiOps.filter(u => u.id !== profile?.id).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowReasign(null)}
                    className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
                  <button onClick={() => reasign(opId, assId)} disabled={saving}
                    className="flex-1 py-2 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                    style={{ background: '#d97706' }}>
                    {saving ? 'Reasignando...' : '↩ Reasignar'}
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
