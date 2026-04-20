import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { gLabel } from '../utils';
import { ACCENT } from '../constants';
import toast from 'react-hot-toast';
import { orderBy } from 'firebase/firestore';

const SIZES_REF = ['XS/6','S/8','M/10','L/12','XL/14','XXL/16','28','30','32','34','36','38','40','42','44'];
const SIZES_INS = ['8','10','12','15','17','20'];

const nowStr = () => {
  const d = new Date();
  return d.toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
};
const todayISO = () => new Date().toISOString().split('T')[0];

// ─── CANVAS DE FIRMA ─────────────────────────────────────────────────────────
function FirmaCanvas({ onSave, label }) {
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const [hasFirma, setHasFirma] = useState(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a3a6b';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasFirma(true);
  };

  const stop = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasFirma(false);
    onSave(null);
  };

  const save = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    toast.success('Firma guardada');
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</p>
      <div style={{ border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={360} height={80}
          style={{ display: 'block', touchAction: 'none', cursor: 'crosshair', width: '100%' }}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={clear} style={{ fontSize: 10, padding: '3px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
          Borrar
        </button>
        {hasFirma && (
          <button onClick={save} style={{ fontSize: 10, padding: '3px 10px', background: '#dcfce7', color: '#15803d', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
            ✓ Guardar firma
          </button>
        )}
      </div>
    </div>
  );
}

// ─── GENERAR PDF ─────────────────────────────────────────────────────────────
function printRemision(rem, satName) {
  const lot = rem.lot || {};
  const garmentRows = (lot.garments || []).map((g) => {
    const sizes = SIZES_REF.map(s => {
      const key = s.split('/')[0];
      const val = g.sizes?.[key] || g.sizes?.[s] || '';
      return `<td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${val||''}</td>`;
    }).join('');
    return `<tr>
      <td style="border:1px solid #1a3a6b;padding:3px 6px;font-size:10px;font-weight:500;color:#1a3a6b">${gLabel(g.gtId)}</td>
      ${sizes}
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;font-weight:700;background:#dce6f5">${g.total?.toLocaleString('es-CO')||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;font-weight:700;background:#fff0e0;color:#e85d26">${rem.cortesRef?.[rem.lot?.garments?.indexOf?.(g)]||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 4px;font-size:9px;color:#4a3a6b;font-style:italic;background:#fdfbff">${rem.comentariosRef?.[rem.lot?.garments?.indexOf?.(g)]||''}</td>
    </tr>`;
  }).join('');

  const emptyRef = Array(Math.max(0,5-(lot.garments||[]).length)).fill(0).map(()=>`
    <tr>${['<td style="border:1px solid #1a3a6b;padding:3px 6px;height:22px">&nbsp;</td>',
    ...SIZES_REF.map(()=>'<td style="border:1px solid #1a3a6b"></td>'),
    '<td style="border:1px solid #1a3a6b;background:#dce6f5"></td>',
    '<td style="border:1px solid #1a3a6b;background:#fff0e0"></td>',
    '<td style="border:1px solid #1a3a6b;background:#fdfbff"></td>'].join('')}</tr>`).join('');

  const insRows = (rem.insumos||Array(4).fill({})).map((ins,i)=>{
    const sc = SIZES_INS.map(s=>`<td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${ins[s]||''}</td>`).join('');
    return `<tr>
      <td style="border:1px solid #1a3a6b;padding:3px 6px;font-size:10px;height:22px">${ins.nombre||''}</td>
      ${sc}
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${ins.marquilla||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${ins.boton||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${ins.garras||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;background:#faf8f5">${ins.otro1||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;background:#faf8f5">${ins.otro2||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 4px;font-size:9px;color:#4a3a6b;font-style:italic;background:#fdfbff">${rem.comentariosIns?.[i]||''}</td>
    </tr>`;
  }).join('');

  const firmaBox = (label, firmaImg, nombre, fecha) => `
    <div style="text-align:center;padding:6px 14px">
      ${firmaImg ? `<img src="${firmaImg}" style="height:50px;display:block;margin:0 auto 4px;border-bottom:1px solid #1a3a6b;width:80%">` : `<div style="height:50px;border-bottom:1px solid #1a3a6b;margin:0 16px"></div>`}
      <div style="font-size:9px;font-weight:700;color:#1a3a6b;letter-spacing:0.1em">${label}</div>
      ${nombre ? `<div style="font-size:9px;color:#374151;margin-top:2px">${nombre}</div>` : ''}
      ${fecha  ? `<div style="font-size:8px;color:#6b7280">${fecha}</div>` : ''}
    </div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Remisión ${rem.remNum} — ${satName}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#fff}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style>
  </head><body>
  <div style="max-width:960px;margin:10px auto;border:1.5px solid #1a3a6b">
    <div style="border-bottom:2px solid #1a3a6b;padding:8px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="width:72px;height:56px;border:1.5px dashed #9ca3af;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#f9f9f7">
        <span style="font-size:8px;color:#9ca3af;text-align:center">Logo<br>cliente</span>
      </div>
      <div style="text-align:center;flex:1">
        <div style="font-size:17px;font-weight:900;color:#1a3a6b">Dotaciones <span style="color:#e85d26">EL ROHI</span></div>
        <div style="font-size:9px;color:#1a3a6b;font-weight:500">NIT. 901.080.234-7</div>
        <div style="font-size:9px;color:#1a3a6b;font-weight:500">Calle 39 A Sur No. 5-63 Este La Victoria · Cel.: 313 372 5739</div>
      </div>
      <div style="border:2px solid #1a3a6b;padding:4px 10px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:#1a3a6b;letter-spacing:0.1em">REMISIÓN</div>
        <div style="font-size:20px;font-weight:900;color:#e85d26;font-family:monospace">${rem.remNum}</div>
      </div>
    </div>
    <div style="display:flex;border-bottom:1px solid #1a3a6b">
      <div style="border-right:1px solid #1a3a6b;padding:4px 10px;display:flex;align-items:center;gap:6px">
        <span style="font-size:8px;font-weight:700;color:#1a3a6b">FECHA</span>
        <span style="font-size:12px;font-weight:700;color:#1a3a6b;font-family:monospace">${rem.date||todayISO()}</span>
      </div>
      <div style="flex:1;padding:6px 14px;display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;font-weight:700;color:#1a3a6b">Satélite:</span>
        <span style="font-size:14px;font-weight:700;color:#1a3a6b">${satName}</span>
      </div>
      <div style="padding:6px 14px;display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;font-weight:700;color:#1a3a6b">Lote:</span>
        <span style="font-size:11px;font-weight:700;color:#e85d26;font-family:monospace">${rem.lotCode||''}</span>
      </div>
    </div>
    <div style="background:#1a3a6b;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.12em;padding:3px 8px">REFERENCIAS — PRENDAS</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <thead><tr>
        <th style="width:100px;border:1px solid #1a3a6b;padding:3px 6px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:left">Referencia</th>
        ${SIZES_REF.map(s=>`<th style="width:${s.includes('/')?'32':'28'}px;border:1px solid #1a3a6b;padding:3px 2px;background:#e8eef7;font-size:8px;font-weight:700;color:#1a3a6b;text-align:center">${s}</th>`).join('')}
        <th style="width:46px;border:1px solid #1a3a6b;padding:3px 2px;background:#dce6f5;font-size:9px;font-weight:700;color:#1a3a6b;text-align:center">TOTAL</th>
        <th style="width:44px;border:1px solid #1a3a6b;padding:3px 2px;background:#fff0e0;font-size:9px;font-weight:700;color:#e85d26;text-align:center">#CORTE</th>
        <th style="width:90px;border:1px solid #1a3a6b;padding:3px 2px;background:#f5f0fa;font-size:8px;font-weight:700;color:#4a3a6b;text-align:center;font-style:italic">Comentarios</th>
      </tr></thead>
      <tbody>${garmentRows}${emptyRef}</tbody>
    </table>
    <div style="background:#1a3a6b;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.12em;padding:3px 8px">INSUMOS ENTREGADOS</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <thead><tr>
        <th style="width:100px;border:1px solid #1a3a6b;padding:3px 6px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:left">Insumo</th>
        ${SIZES_INS.map(s=>`<th style="width:36px;border:1px solid #1a3a6b;padding:3px 2px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:center">${s}</th>`).join('')}
        <th style="width:66px;border:1px solid #1a3a6b;padding:3px 2px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:center">Marquilla</th>
        <th style="width:56px;border:1px solid #1a3a6b;padding:3px 2px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:center">Botón</th>
        <th style="width:56px;border:1px solid #1a3a6b;padding:3px 2px;background:#e8eef7;font-size:9px;font-weight:700;color:#1a3a6b;text-align:center">Garras</th>
        <th style="width:66px;border:1px solid #1a3a6b;padding:3px 2px;background:#f0ede8;font-size:8px;font-weight:700;color:#6b5c45;text-align:center">${rem.otrosCols?.[0]?.name||'Otro 1'}</th>
        <th style="width:66px;border:1px solid #1a3a6b;padding:3px 2px;background:#f0ede8;font-size:8px;font-weight:700;color:#6b5c45;text-align:center">${rem.otrosCols?.[1]?.name||'Otro 2'}</th>
        <th style="width:90px;border:1px solid #1a3a6b;padding:3px 2px;background:#f5f0fa;font-size:8px;font-weight:700;color:#4a3a6b;text-align:center;font-style:italic">Comentarios</th>
      </tr></thead>
      <tbody>${insRows}</tbody>
    </table>
    <div style="border-top:1px solid #1a3a6b;padding:7px 12px;display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;font-weight:700;color:#1a3a6b;white-space:nowrap">NOTA: Se entregan insumos a:</span>
      <span style="flex:1;border-bottom:1px solid #1a3a6b;min-height:18px;display:inline-block">${rem.nota||''}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #1a3a6b">
      ${firmaBox('Entregada', rem.firmaEntregada, rem.nombreEntregada, rem.fechaEntregada)}
      <div style="border-left:1px solid #1a3a6b">
      ${firmaBox('Aceptada', rem.firmaAceptada, rem.nombreAceptada, rem.fechaAceptada)}
      </div>
    </div>
  </div>
  <script>window.onload=()=>window.print();</script>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

// ─── ESTADOS DE REMISIÓN ──────────────────────────────────────────────────────
const REM_STATUS = {
  borrador:  { label: 'Borrador',           cls: 'bg-gray-100 text-gray-600'    },
  enviada:   { label: 'Enviada — Pend. firma satélite', cls: 'bg-amber-100 text-amber-800' },
  completada:{ label: 'Firmada por ambas partes', cls: 'bg-green-100 text-green-800'  },
};

// ─── PANTALLA PRINCIPAL ───────────────────────────────────────────────────────
export function RemisionScreen() {
  const { profile }               = useAuth();
  const { lots, satellites, clients } = useData();
  const [tab, setTab]             = useState('nueva');
  const [remisiones, setRemisiones] = useState([]);

  useEffect(() => {
    const unsub = listenCol('remisiones', setRemisiones, orderBy('createdAt','desc'));
    return unsub;
  }, []);

  const isElrohi = ['gerente','admin_elrohi','corte'].includes(profile?.role);
  const isSat    = profile?.role === 'admin_satelite';

  const myPending = isSat
    ? remisiones.filter(r => r.satId === profile.satId && r.status === 'enviada')
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-gray-900">Remisión de Corte</h1>
        {myPending.length > 0 && (
          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full">
            ⏳ {myPending.length} pendiente{myPending.length>1?'s':''} de firma
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {isElrohi && [['nueva','Nueva Remisión'],['historial','Historial']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
        {isSat && [['pendientes',`Pendientes (${myPending.length})`],['historial','Historial']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {tab==='nueva'   && isElrohi && <NuevaRemision lots={lots} satellites={satellites} clients={clients} profile={profile} />}
      {tab==='pendientes' && isSat && <PendientesFirma remisiones={myPending} satellites={satellites} profile={profile} setRemisiones={setRemisiones} />}
      {tab==='historial' && <HistorialRemisiones remisiones={remisiones} satellites={satellites} profile={profile} />}
    </div>
  );
}

// ─── NUEVA REMISIÓN ────────────────────────────────────────────────────────────
function NuevaRemision({ lots, satellites, clients, profile }) {
  const assignedLots = lots.filter(l => ['asignacion','costura','corte','activacion'].includes(l.status));
  const [selLotId,    setSelLotId]    = useState('');
  const [remNum,      setRemNum]      = useState('0042');
  const [insumos,     setInsumos]     = useState(Array(4).fill(null).map(()=>({nombre:'',8:'',10:'',12:'',15:'',17:'',20:'',marquilla:'',boton:'',garras:'',otro1:'',otro2:''})));
  const [comentRef,   setComentRef]   = useState(Array(5).fill(''));
  const [cortesRef,   setCortesRef]   = useState(Array(5).fill(''));
  const [comentIns,   setComentIns]   = useState(Array(4).fill(''));
  const [otrosCols,   setOtrosCols]   = useState([{name:'Otro 1'},{name:'Otro 2'}]);
  const [nota,        setNota]        = useState('');
  const [firmaImg,    setFirmaImg]    = useState(null);
  const [nombre,      setNombre]      = useState(profile?.name||'');
  const [saving,      setSaving]      = useState(false);
  const [showFirma,   setShowFirma]   = useState(false);

  const selLot = lots.find(l => l.id === selLotId);
  const satName = satellites.find(s => s.id === selLot?.satId)?.name || '_______________';
  const updIns  = (i,f,v) => { const n=[...insumos]; n[i]={...n[i],[f]:v}; setInsumos(n); };

  const enviar = async () => {
    if (!selLot)  { toast.error('Selecciona un lote'); return; }
    if (!firmaImg){ toast.error('Dibuja y guarda tu firma'); return; }
    if (!nombre)  { toast.error('Escribe tu nombre'); return; }
    setSaving(true);
    try {
      await addDocument('remisiones', {
        remNum:         remNum.padStart(4,'0'),
        lotId:          selLot.id,
        lotCode:        selLot.code,
        satId:          selLot.satId,
        satName,
        clientId:       selLot.clientId,
        status:         'enviada',
        date:           todayISO(),
        lot:            selLot,
        insumos,
        comentariosRef: comentRef,
        cortesRef,
        comentariosIns: comentIns,
        otrosCols,
        nota,
        firmaEntregada: firmaImg,
        nombreEntregada: nombre,
        fechaEntregada:  nowStr(),
        firmaAceptada:   null,
        nombreAceptada:  null,
        fechaAceptada:   null,
      });
      toast.success(`✅ Remisión ${remNum} enviada al satélite`);
      setSelLotId(''); setFirmaImg(null); setShowFirma(false);
    } catch(e) { console.error(e); toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {/* Selector */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Lote</label>
            <select value={selLotId} onChange={e=>setSelLotId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400">
              <option value="">— Seleccionar lote —</option>
              {assignedLots.map(l=><option key={l.id} value={l.id}>{l.code}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Satélite receptor</label>
            <input readOnly value={satName} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 font-semibold text-blue-800" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Número de remisión</label>
            <input value={remNum} onChange={e=>setRemNum(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-400" style={{color:'#e85d26'}} />
          </div>
        </div>
      </div>

      {selLot && (<>
        {/* Referencias */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Referencias del lote</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{tableLayout:'fixed'}}>
              <thead>
                <tr style={{background:'#e8eef7'}}>
                  <th className="border border-blue-200 px-2 py-1.5 text-left text-[10px] text-blue-800 font-bold" style={{width:'110px'}}>Referencia</th>
                  {SIZES_REF.map(s=><th key={s} className="border border-blue-200 px-1 py-1.5 text-[9px] text-blue-700 font-bold" style={{width:'32px'}}>{s}</th>)}
                  <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold" style={{background:'#dce6f5',width:'46px',color:'#1a3a6b'}}>TOTAL</th>
                  <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold" style={{background:'#fff0e0',color:'#e85d26',width:'50px'}}>#CORTE</th>
                  <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold italic" style={{background:'#f5f0fa',color:'#4a3a6b',width:'90px'}}>Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {selLot.garments.map((g,i)=>(
                  <tr key={i}>
                    <td className="border border-blue-100 px-2 py-1 font-medium" style={{color:'#1a3a6b'}}>{gLabel(g.gtId)}</td>
                    {SIZES_REF.map(s=>{const key=s.split('/')[0];const val=g.sizes?.[key]||g.sizes?.[s]||'';return <td key={s} className="border border-blue-100 px-1 py-1 text-center font-semibold" style={{color:val?'#1a3a6b':'#d1d5db'}}>{val||'—'}</td>;})}
                    <td className="border border-blue-100 px-1 py-1 text-center font-bold" style={{background:'#f0f4f8',color:'#1a3a6b'}}>{g.total?.toLocaleString('es-CO')}</td>
                    <td className="border border-blue-100 px-1 py-1" style={{background:'#fff8f0'}}>
                      <input type="text" placeholder="590" value={cortesRef[i]||''} onChange={e=>{const n=[...cortesRef];n[i]=e.target.value;setCortesRef(n);}}
                        className="w-full text-center text-xs font-bold outline-none bg-transparent" style={{color:'#e85d26'}} />
                    </td>
                    <td className="border border-blue-100 px-1 py-1" style={{background:'#fdfbff'}}>
                      <input type="text" placeholder="Observación..." value={comentRef[i]||''} onChange={e=>{const n=[...comentRef];n[i]=e.target.value;setComentRef(n);}}
                        className="w-full text-xs italic outline-none bg-transparent" style={{color:'#4a3a6b'}} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insumos */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Insumos entregados</p>
            <div className="flex gap-2">
              <input value={otrosCols[0].name} onChange={e=>setOtrosCols([{name:e.target.value},otrosCols[1]])}
                className="border border-amber-200 rounded px-2 py-0.5 text-xs font-medium w-20 focus:outline-none" style={{color:'#92400e'}} />
              <input value={otrosCols[1].name} onChange={e=>setOtrosCols([otrosCols[0],{name:e.target.value}])}
                className="border border-amber-200 rounded px-2 py-0.5 text-xs font-medium w-20 focus:outline-none" style={{color:'#92400e'}} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{tableLayout:'fixed'}}>
              <thead>
                <tr style={{background:'#e8eef7'}}>
                  <th className="border border-blue-200 px-2 py-1.5 text-left text-[10px] text-blue-800 font-bold" style={{width:'108px'}}>Insumo</th>
                  {SIZES_INS.map(s=><th key={s} className="border border-blue-200 px-1 py-1.5 text-[9px] text-blue-700 font-bold" style={{width:'36px'}}>{s}</th>)}
                  {['Marquilla','Botón','Garras'].map(h=><th key={h} className="border border-blue-200 px-1 py-1.5 text-[9px] text-blue-700 font-bold" style={{width:'56px'}}>{h}</th>)}
                  <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold" style={{background:'#f0ede8',color:'#6b5c45',width:'60px'}}>{otrosCols[0].name}</th>
                  <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold" style={{background:'#f0ede8',color:'#6b5c45',width:'60px'}}>{otrosCols[1].name}</th>
                  <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold italic" style={{background:'#f5f0fa',color:'#4a3a6b',width:'88px'}}>Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((ins,i)=>(
                  <tr key={i}>
                    <td className="border border-blue-100 px-1 py-1">
                      <input value={ins.nombre} onChange={e=>updIns(i,'nombre',e.target.value)} placeholder={`Insumo ${i+1}`}
                        className="w-full text-xs font-medium outline-none bg-transparent" style={{color:'#1a3a6b'}} />
                    </td>
                    {SIZES_INS.map(s=><td key={s} className="border border-blue-100 px-1 py-1"><input value={ins[s]} onChange={e=>updIns(i,s,e.target.value)} className="w-full text-center text-xs font-semibold outline-none bg-transparent" style={{color:'#1a3a6b'}} /></td>)}
                    {['marquilla','boton','garras'].map(f=><td key={f} className="border border-blue-100 px-1 py-1"><input value={ins[f]} onChange={e=>updIns(i,f,e.target.value)} className="w-full text-center text-xs outline-none bg-transparent" style={{color:'#1a3a6b'}} /></td>)}
                    {['otro1','otro2'].map(f=><td key={f} className="border border-blue-100 px-1 py-1" style={{background:'#faf8f5'}}><input value={ins[f]} onChange={e=>updIns(i,f,e.target.value)} className="w-full text-center text-xs outline-none bg-transparent" style={{color:'#6b5c45'}} /></td>)}
                    <td className="border border-blue-100 px-1 py-1" style={{background:'#fdfbff'}}>
                      <input value={comentIns[i]||''} onChange={e=>{const n=[...comentIns];n[i]=e.target.value;setComentIns(n);}} placeholder="Obs..." className="w-full text-xs italic outline-none bg-transparent" style={{color:'#4a3a6b'}} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nota */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <label className="text-xs font-semibold text-gray-600 block mb-1">NOTA: Se entregan insumos a:</label>
          <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Especificar..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </div>

        {/* Firma Entregada */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tu firma — "Entregada"</p>
            {firmaImg && <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded-full">✓ Firma guardada</span>}
          </div>
          <FirmaCanvas label="Dibuja tu firma:" onSave={setFirmaImg} />
          <div className="mt-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tu nombre completo</label>
            <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Escribe tu nombre..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>
        </div>

        {/* Botón enviar */}
        <button onClick={enviar} disabled={saving}
          className="w-full py-3 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90"
          style={{background:'#1a3a6b'}}>
          {saving ? 'Guardando...' : '📤 Enviar Remisión al Satélite'}
        </button>
      </>)}

      {!selLot && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">📄</p>
          <p className="font-medium text-gray-700">Selecciona un lote arriba</p>
          <p className="text-sm text-gray-400 mt-1">La remisión se llenará automáticamente</p>
        </div>
      )}
    </div>
  );
}

// ─── PENDIENTES DE FIRMA (Satélite) ───────────────────────────────────────────
function PendientesFirma({ remisiones, satellites, profile }) {
  const [sel,      setSel]      = useState(null);
  const [firmaImg, setFirmaImg] = useState(null);
  const [nombre,   setNombre]   = useState(profile?.name||'');
  const [saving,   setSaving]   = useState(false);

  const firmar = async (rem) => {
    if (!firmaImg){ toast.error('Dibuja y guarda tu firma'); return; }
    if (!nombre)  { toast.error('Escribe tu nombre'); return; }
    setSaving(true);
    try {
      await updateDocument('remisiones', rem.id, {
        status:         'completada',
        firmaAceptada:  firmaImg,
        nombreAceptada: nombre,
        fechaAceptada:  nowStr(),
      });
      toast.success('✅ Remisión firmada y archivada');
      setSel(null); setFirmaImg(null);
    } catch(e) { toast.error('Error al firmar'); }
    finally { setSaving(false); }
  };

  if (remisiones.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-100">
      <p className="text-4xl mb-3">✅</p>
      <p className="font-medium text-gray-700">Sin remisiones pendientes</p>
      <p className="text-sm text-gray-400 mt-1">No tienes remisiones por firmar</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {remisiones.map(rem => (
        <div key={rem.id} className="bg-white rounded-xl border-2 border-amber-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold" style={{color:'#e85d26'}}>Remisión {rem.remNum}</span>
                <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">⏳ Pendiente tu firma</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Lote: {rem.lotCode} · Fecha: {rem.date}</p>
              <p className="text-xs text-gray-500">Enviada por: {rem.nombreEntregada}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>printRemision(rem, rem.satName)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                🖨️ Ver
              </button>
              <button onClick={()=>setSel(sel?.id===rem.id?null:rem)}
                className="text-xs px-3 py-1.5 rounded-lg text-white font-bold"
                style={{background:'#1a3a6b'}}>
                ✍ Firmar
              </button>
            </div>
          </div>

          {sel?.id === rem.id && (
            <div className="border-t border-amber-100 pt-3 mt-2">
              <FirmaCanvas label="Dibuja tu firma de aceptación:" onSave={setFirmaImg} />
              <div className="mt-2 mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tu nombre completo</label>
                <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Escribe tu nombre..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
              </div>
              <button onClick={()=>firmar(rem)} disabled={saving}
                className="w-full py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:'#15803d'}}>
                {saving ? 'Guardando...' : '✅ Confirmar recepción y firmar'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── HISTORIAL ────────────────────────────────────────────────────────────────
function HistorialRemisiones({ remisiones, satellites, profile }) {
  const isSat = profile?.role === 'admin_satelite';
  const list  = isSat ? remisiones.filter(r => r.satId === profile.satId) : remisiones;

  if (list.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-100">
      <p className="text-4xl mb-3">📋</p>
      <p className="font-medium text-gray-700">Sin remisiones registradas</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {list.map(rem => {
        const st = REM_STATUS[rem.status] || REM_STATUS.borrador;
        return (
          <div key={rem.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs font-bold" style={{color:'#e85d26'}}>Rem. {rem.remNum}</span>
                  <span className={`${st.cls} px-2 py-0.5 rounded-full text-[9px] font-bold`}>{st.label}</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{rem.satName}</p>
                <p className="text-[10px] text-gray-400">Lote: {rem.lotCode} · {rem.date}</p>
              </div>
              <button onClick={()=>printRemision(rem, rem.satName)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                🖨️ Imprimir
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="text-xs">
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Entregada por</p>
                {rem.firmaEntregada && <img src={rem.firmaEntregada} alt="firma" style={{height:32,borderBottom:'1px solid #e5e7eb',marginBottom:3,maxWidth:'100%'}} />}
                <p className="font-medium text-gray-700">{rem.nombreEntregada||'—'}</p>
                <p className="text-[9px] text-gray-400">{rem.fechaEntregada||'—'}</p>
              </div>
              <div className="text-xs">
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Aceptada por</p>
                {rem.firmaAceptada ? <>
                  <img src={rem.firmaAceptada} alt="firma" style={{height:32,borderBottom:'1px solid #e5e7eb',marginBottom:3,maxWidth:'100%'}} />
                  <p className="font-medium text-gray-700">{rem.nombreAceptada}</p>
                  <p className="text-[9px] text-gray-400">{rem.fechaAceptada}</p>
                </> : <p className="text-gray-300 italic">Pendiente firma satélite</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
