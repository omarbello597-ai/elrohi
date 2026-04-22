import { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { LOT_STATUS, ACCENT } from '../constants';
import { gLabel, fmtM } from '../utils';
import { durationSince, fmtDuration } from '../services/consecutivos';

const ETAPAS = [
  { key: 'nuevo',                   label: 'Corte',       icon: '✂',  color: '#6366f1' },
  { key: 'asignacion',              label: 'Satélite',    icon: '🏭', color: '#f59e0b' },
  { key: 'costura',                 label: 'Costura',     icon: '🪡', color: '#3b82f6' },
  { key: 'tintoreria',              label: 'Tintorería',  icon: '🎨', color: '#8b5cf6' },
  { key: 'en_operaciones_elrohi',   label: 'Ops ELROHI',  icon: '⚡', color: '#e85d26' },
  { key: 'en_revision_calidad',     label: 'Calidad',     icon: '🔍', color: '#ec4899' },
  { key: 'bodega_lonas',            label: 'Bodega',      icon: '📦', color: '#10b981' },
  { key: 'despachado',              label: 'Despachado',  icon: '🚚', color: '#1a3a6b' },
];

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function getDuracionMs(timeline, statusKey) {
  if (!timeline) return null;
  const entry = timeline.find(t => t.status === statusKey);
  if (!entry) return null;
  if (entry.duracionMs) return entry.duracionMs;
  if (entry.entró && entry.salió) return new Date(entry.salió) - new Date(entry.entró);
  if (entry.entró && !entry.salió) return Date.now() - new Date(entry.entró).getTime();
  return null;
}

function getColorByDuration(ms) {
  if (!ms) return '#6b7280';
  const hours = ms / 3600000;
  if (hours < 24)  return '#10b981'; // verde — menos de 1 día
  if (hours < 72)  return '#f59e0b'; // amarillo — 1-3 días
  return '#ef4444';                  // rojo — más de 3 días
}

function TiempoChip({ ms, activo }) {
  if (!ms && !activo) return <span className="text-[9px] text-gray-300">—</span>;
  const color = activo ? '#3b82f6' : getColorByDuration(ms);
  const texto = activo ? `⏱ ${fmtDuration(ms)||'en curso'}` : fmtDuration(ms);
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
      style={{background:`${color}20`, color}}>
      {texto}
    </span>
  );
}

export default function TrazabilidadScreen() {
  const { lots } = useData();
  const [busqueda, setBusqueda] = useState('');
  const [mesActivo, setMesActivo] = useState(new Date().getMonth());
  const [añoActivo, setAñoActivo] = useState(new Date().getFullYear());
  const [selLot, setSelLot] = useState(null);

  // Filtrar lotes del mes activo
  const lotesMes = lots.filter(l => {
    if (!l.created) return false;
    const fecha = new Date(l.created);
    return fecha.getMonth() === mesActivo && fecha.getFullYear() === añoActivo;
  });

  // Filtrar por búsqueda
  const lotesFiltrados = busqueda
    ? lots.filter(l => l.code?.toLowerCase().includes(busqueda.toLowerCase()))
    : lotesMes;

  // Estadísticas del mes
  const totalPiezas   = lotesMes.reduce((a,l) => a+(l.totalPieces||0), 0);
  const completados   = lotesMes.filter(l => l.status === 'despachado').length;
  const enProceso     = lotesMes.filter(l => !['despachado'].includes(l.status)).length;

  // Calcular tiempo promedio por etapa
  const promedioEtapa = (statusKey) => {
    const tiempos = lotesMes
      .map(l => getDuracionMs(l.timeline, statusKey))
      .filter(t => t && t > 0);
    if (tiempos.length === 0) return null;
    return tiempos.reduce((a,b) => a+b, 0) / tiempos.length;
  };

  // Meses disponibles
  const mesesDisp = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    mesesDisp.push({ mes: d.getMonth(), año: d.getFullYear() });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-sm font-bold text-gray-900">Trazabilidad de Producción</h1>
          <p className="text-xs text-gray-400">Seguimiento completo del ciclo de cada corte</p>
        </div>
        {/* Buscador */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <span className="text-gray-400 text-sm">🔍</span>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar corte... ej: Corte-0001"
            className="text-xs outline-none bg-transparent w-44"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          )}
        </div>
      </div>

      {/* Selector de mes */}
      {!busqueda && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {mesesDisp.map(({mes, año}) => (
            <button key={`${mes}-${año}`}
              onClick={() => { setMesActivo(mes); setAñoActivo(año); }}
              className="px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
              style={{
                background: mesActivo===mes&&añoActivo===año ? '#1a3a6b' : '#f1f0ec',
                color: mesActivo===mes&&añoActivo===año ? '#fff' : '#6b7280',
              }}>
              {MONTH_NAMES[mes]} {año}
            </button>
          ))}
        </div>
      )}

      {/* Stats del mes */}
      {!busqueda && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            ['Cortes del mes', lotesMes.length, '#1a3a6b'],
            ['Total piezas', totalPiezas.toLocaleString('es-CO'), '#2563eb'],
            ['En proceso', enProceso, '#e85d26'],
            ['Completados', completados, '#10b981'],
          ].map(([l,v,c]) => (
            <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className="text-xl font-black" style={{color:c}}>{v}</p>
              <p className="text-[9px] text-gray-400 uppercase tracking-wide mt-0.5">{l}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tiempos promedio por etapa */}
      {!busqueda && lotesMes.some(l => l.timeline?.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">⏱ Tiempos promedio por etapa — {MONTH_NAMES[mesActivo]}</p>
          <div className="flex gap-2 flex-wrap">
            {ETAPAS.map(etapa => {
              const avg = promedioEtapa(etapa.key);
              if (!avg) return null;
              const color = getColorByDuration(avg);
              return (
                <div key={etapa.key} className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                  style={{borderColor:`${color}30`, background:`${color}08`}}>
                  <span className="text-base">{etapa.icon}</span>
                  <div>
                    <p className="text-[10px] font-bold text-gray-700">{etapa.label}</p>
                    <p className="text-[10px] font-black" style={{color}}>{fmtDuration(avg)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-gray-400 mt-2">🟢 &lt;1 día · 🟡 1-3 días · 🔴 &gt;3 días</p>
        </div>
      )}

      {/* Lista de cortes */}
      {lotesFiltrados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-medium text-gray-700">
            {busqueda ? 'No se encontró ese corte' : `Sin cortes en ${MONTH_NAMES[mesActivo]} ${añoActivo}`}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {busqueda ? 'Verifica el número de corte' : 'Los cortes creados este mes aparecerán aquí'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {lotesFiltrados.map(lot => {
          const st       = LOT_STATUS[lot.status];
          const isOpen   = selLot === lot.id;
          const timeline = lot.timeline || [];
          const totalTiempo = timeline.reduce((a,t) => a+(t.duracionMs||0), 0);

          return (
            <div key={lot.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {/* Header del lote */}
              <button
                onClick={() => setSelLot(isOpen ? null : lot.id)}
                className="w-full text-left p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xs font-black text-blue-700">{lot.code}</span>
                  <span className={`${st?.cls||'bg-gray-100 text-gray-500'} text-[9px] px-2 py-0.5 rounded-full font-bold`}>
                    {st?.label||lot.status}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {lot.totalPieces?.toLocaleString('es-CO')} pzas
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {lot.garments?.map(g=>gLabel(g.gtId)).join(', ')}
                  </span>
                  {totalTiempo > 0 && (
                    <span className="text-[10px] text-gray-500 ml-auto">
                      Total: <strong>{fmtDuration(totalTiempo)}</strong>
                    </span>
                  )}
                  <span className="text-gray-400 text-xs ml-auto">{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Mini timeline */}
                <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1">
                  {ETAPAS.map((etapa, i) => {
                    const entry   = timeline.find(t => t.status === etapa.key);
                    const durMs   = getDuracionMs(timeline, etapa.key);
                    const activo  = lot.status === etapa.key;
                    const done    = entry && entry.salió;
                    const hasData = entry || activo;
                    return (
                      <div key={etapa.key} className="flex items-center flex-shrink-0">
                        <div className="flex flex-col items-center">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{
                              background: done ? etapa.color : activo ? `${etapa.color}40` : '#f1f0ec',
                              color: done ? '#fff' : activo ? etapa.color : '#9ca3af',
                              border: activo ? `2px solid ${etapa.color}` : 'none',
                            }}>
                            {done ? '✓' : etapa.icon}
                          </div>
                          <p className="text-[7px] mt-0.5 text-center whitespace-nowrap"
                            style={{color: hasData ? etapa.color : '#d1d5db'}}>
                            {etapa.label}
                          </p>
                          {durMs && <TiempoChip ms={durMs} activo={activo&&!done} />}
                        </div>
                        {i < ETAPAS.length-1 && (
                          <div className="w-4 h-0.5 mx-0.5 flex-shrink-0"
                            style={{background: done ? etapa.color : '#e5e7eb'}} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </button>

              {/* Detalle expandible */}
              {isOpen && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">

                  {/* Prendas */}
                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Prendas del corte</p>
                    <div className="flex flex-wrap gap-2">
                      {lot.garments?.map((g,i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
                          <span className="font-bold text-gray-800">{gLabel(g.gtId)}</span>
                          <span className="text-gray-500 ml-1">{g.total?.toLocaleString('es-CO')} pzas</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Timeline detallado */}
                  {timeline.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Timeline detallado</p>
                      <div className="space-y-2">
                        {timeline.map((t,i) => {
                          const st2   = LOT_STATUS[t.status];
                          const etapa = ETAPAS.find(e => e.key === t.status);
                          const color = etapa?.color || '#6b7280';
                          const durMs = t.duracionMs || (t.entró && t.salió ? new Date(t.salió)-new Date(t.entró) : null);
                          const enCurso = t.entró && !t.salió;
                          return (
                            <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-white border border-gray-100">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
                                style={{background:`${color}20`}}>
                                {etapa?.icon||'📍'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs font-bold text-gray-800">{st2?.label||t.status}</p>
                                  {durMs && <TiempoChip ms={durMs} activo={enCurso} />}
                                  {enCurso && <span className="text-[9px] text-blue-500 italic">⏱ En curso ahora</span>}
                                </div>
                                <div className="flex gap-3 mt-0.5">
                                  {t.entró && <p className="text-[9px] text-gray-400">Entró: {new Date(t.entró).toLocaleString('es-CO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>}
                                  {t.salió && <p className="text-[9px] text-gray-400">Salió: {new Date(t.salió).toLocaleString('es-CO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>}
                                </div>
                                {t.cambiadoPor && <p className="text-[9px] text-gray-300">por {t.cambiadoPor}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Operaciones costura */}
                  {lot.lotOps?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Operaciones de costura</p>
                      <div className="space-y-1">
                        {lot.lotOps.map((op,i) => {
                          const durMs = op.startedAt && op.doneAt ? new Date(op.doneAt)-new Date(op.startedAt) : null;
                          return (
                            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100 text-xs">
                              <span className={`w-2 h-2 rounded-full ${op.status==='completado'?'bg-green-500':'bg-gray-300'}`} />
                              <span className="flex-1 text-gray-700">{op.name||op.opId}</span>
                              <span className="text-gray-400">{op.qty} pzas</span>
                              {durMs && <TiempoChip ms={durMs} activo={false} />}
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${op.status==='completado'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>
                                {op.status==='completado'?'✓ Listo':'Pendiente'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sin timeline */}
                  {timeline.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-3xl mb-2">📊</p>
                      <p className="text-xs text-gray-500">Este lote no tiene datos de timeline registrados</p>
                      <p className="text-[10px] text-gray-400 mt-1">Los nuevos lotes registrarán automáticamente los tiempos</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
