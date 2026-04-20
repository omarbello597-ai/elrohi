import { useState, useRef } from 'react';
import { useAuth }          from '../contexts/AuthContext';
import { useData }          from '../contexts/DataContext';
import { advanceLot, addDocument, updateDocument, listenCol } from '../services/db';
import { EmptyState }       from '../components/ui';
import { cLabel, gLabel }   from '../utils';
import { LOT_PRIORITY, ACCENT } from '../constants';
import { orderBy }          from 'firebase/firestore';
import { useEffect }        from 'react';
import toast from 'react-hot-toast';

const SIZES_REF = ['XS/6','S/8','M/10','L/12','XL/14','XXL/16','28','30','32','34','36','38','40','42','44'];

// ─── NOMBRE DE DOCUMENTO ──────────────────────────────────────────────────────
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const genNombre = (num) => {
  const hoy = new Date();
  const dd  = String(hoy.getDate()).padStart(2,'0');
  const mmm = MESES[hoy.getMonth()];
  const yyy = hoy.getFullYear();
  return `ELROHI_Corte${String(num).padStart(4,'0')}_Fecha_${dd}${mmm}${yyy}`;
};
const todayISO  = () => new Date().toISOString().split('T')[0];
const nowStr    = () => new Date().toLocaleString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const todayLabel= () => {
  const h=new Date();
  return `${String(h.getDate()).padStart(2,'0')}/${String(h.getMonth()+1).padStart(2,'0')}/${String(h.getFullYear()).slice(-2)}`;
};

// ─── SHARED LOT CARD ─────────────────────────────────────────────────────────
function LotCard({ lot, clients, accentColor = ACCENT, children }) {
  const pr = LOT_PRIORITY[lot.priority];
  return (
    <div className="bg-white rounded-xl border-2 p-4" style={{ borderColor: accentColor + '33' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-black" style={{ color: accentColor }}>{lot.code}</span>
            <span className={`${pr.cls} px-2 py-0.5 rounded-full text-[9px] font-semibold`}>{pr.label}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{cLabel(clients, lot.clientId)}</p>
          <p className="text-[10px] text-gray-400">{lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}</p>
          {lot.notes && <p className="text-[10px] text-gray-500 mt-1 italic">"{lot.notes}"</p>}
        </div>
        <div className="flex-shrink-0">{children}</div>
      </div>
    </div>
  );
}

// ─── CANVAS FIRMA ─────────────────────────────────────────────────────────────
function FirmaCanvas({ onSave, label }) {
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const [hasFirma, setHasFirma] = useState(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };
  const start = (e) => { e.preventDefault(); drawing.current=true; const c=canvasRef.current; const ctx=c.getContext('2d'); const p=getPos(e,c); ctx.beginPath(); ctx.moveTo(p.x,p.y); };
  const draw  = (e) => { e.preventDefault(); if(!drawing.current)return; const c=canvasRef.current; const ctx=c.getContext('2d'); ctx.strokeStyle='#1a3a6b'; ctx.lineWidth=2; ctx.lineCap='round'; const p=getPos(e,c); ctx.lineTo(p.x,p.y); ctx.stroke(); setHasFirma(true); };
  const stop  = () => { drawing.current=false; };
  const clear = () => { const c=canvasRef.current; c.getContext('2d').clearRect(0,0,c.width,c.height); setHasFirma(false); onSave(null); };
  const save  = () => { onSave(canvasRef.current.toDataURL('image/png')); toast.success('Firma guardada'); };

  return (
    <div style={{marginBottom:10}}>
      <p style={{fontSize:11,fontWeight:600,color:'#374151',marginBottom:5}}>{label}</p>
      <div style={{border:'1px solid #d1d5db',borderRadius:8,background:'#fff',overflow:'hidden'}}>
        <canvas ref={canvasRef} width={340} height={70} style={{display:'block',touchAction:'none',cursor:'crosshair',width:'100%'}}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
      </div>
      <div style={{display:'flex',gap:6,marginTop:5}}>
        <button onClick={clear} style={{fontSize:10,padding:'2px 9px',background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:4,cursor:'pointer',fontWeight:600}}>Borrar</button>
        {hasFirma && <button onClick={save} style={{fontSize:10,padding:'2px 9px',background:'#dcfce7',color:'#15803d',border:'none',borderRadius:4,cursor:'pointer',fontWeight:600}}>✓ Guardar firma</button>}
      </div>
    </div>
  );
}

// ─── IMPRIMIR FORMATO DE CORTE ─────────────────────────────────────────────────
function printFormato(fc, nombreDoc) {
  const lot = fc.lot || {};
  const garmentRows = (lot.garments||[]).map((g,i) => {
    const sizes = SIZES_REF.map(s => {
      const key = s.split('/')[0];
      const val = g.sizes?.[key] || g.sizes?.[s] || '';
      return `<td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px">${val||''}</td>`;
    }).join('');
    return `<tr>
      <td style="border:1px solid #1a3a6b;padding:3px 6px;font-size:10px;font-weight:500;color:#1a3a6b">${gLabel(g.gtId)}</td>
      ${sizes}
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;font-weight:700;background:#dce6f5;color:#1a3a6b">${g.total?.toLocaleString('es-CO')||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;font-weight:700;background:#fff0e0;color:#e85d26">${fc.cortesRef?.[i]||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 4px;font-size:9px;color:#4a3a6b;font-style:italic;background:#fdfbff">${fc.comentariosRef?.[i]||''}</td>
    </tr>`;
  }).join('');
  const emptyRef = Array(Math.max(0,5-(lot.garments||[]).length)).fill(0).map(()=>`
    <tr>${['<td style="border:1px solid #1a3a6b;padding:3px 6px;height:22px">&nbsp;</td>',
    ...SIZES_REF.map(()=>'<td style="border:1px solid #1a3a6b"></td>'),
    '<td style="border:1px solid #1a3a6b;background:#dce6f5"></td>',
    '<td style="border:1px solid #1a3a6b;background:#fff0e0"></td>',
    '<td style="border:1px solid #1a3a6b;background:#fdfbff"></td>'].join('')}</tr>`).join('');

  const espRows = (fc.especificaciones||[]).map(e=>`
    <tr>
      <td style="border:1px solid #1a3a6b;padding:3px 6px;font-size:10px;font-weight:500;color:#1a3a6b;height:22px">${e.tipoTela||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;font-weight:600;color:#1a3a6b">${e.metrosUsados||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 2px;text-align:center;font-size:10px;font-weight:600;color:#dc2626">${e.metrosDesechados||''}</td>
      <td style="border:1px solid #1a3a6b;padding:3px 4px;font-size:9px;color:#4a3a6b;font-style:italic;background:#fdfbff">${e.comentario||''}</td>
    </tr>`).join('');

  const firmaBox = (label, img, nombre, fecha) => `
    <div style="text-align:center;padding:6px 14px">
      ${img?`<img src="${img}" style="height:44px;display:block;margin:0 auto 3px;border-bottom:1px solid #1a3a6b;width:80%">`:`<div style="height:44px;border-bottom:1px solid #1a3a6b;margin:0 16px"></div>`}
      <div style="font-size:9px;font-weight:700;color:#1a3a6b;letter-spacing:0.1em">${label}</div>
      ${nombre?`<div style="font-size:9px;color:#374151;margin-top:1px">${nombre}</div>`:''}
      ${fecha?`<div style="font-size:8px;color:#6b7280">${fecha}</div>`:''}
    </div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>${nombreDoc}</title>
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
      <div style="border:2px solid #1a3a6b;padding:4px 10px;text-align:center;min-width:80px">
        <div style="font-size:9px;font-weight:700;color:#1a3a6b;letter-spacing:0.1em">CORTE</div>
        <div style="font-size:14px;font-weight:900;color:#e85d26;font-family:monospace">${nombreDoc}</div>
      </div>
    </div>
    <div style="display:flex;border-bottom:1px solid #1a3a6b">
      <div style="border-right:1px solid #1a3a6b;padding:4px 10px;display:flex;align-items:center;gap:6px">
        <span style="font-size:8px;font-weight:700;color:#1a3a6b">FECHA</span>
        <span style="font-size:12px;font-weight:700;color:#1a3a6b;font-family:monospace">${fc.date||todayLabel()}</span>
      </div>
      <div style="flex:1;padding:6px 14px;display:flex;align-items:center;gap:8px">
        <span style="font-size:10px;font-weight:700;color:#1a3a6b;white-space:nowrap">Operario de Corte:</span>
        <span style="font-size:13px;font-weight:700;color:#1a3a6b">${fc.operarioNombre||''}</span>
      </div>
      <div style="padding:6px 14px;display:flex;align-items:center;gap:8px;border-left:1px solid #1a3a6b">
        <span style="font-size:10px;font-weight:700;color:#1a3a6b">Lote:</span>
        <span style="font-size:11px;font-weight:700;color:#e85d26;font-family:monospace">${fc.lotCode||''}</span>
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
    <div style="background:#e85d26;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.12em;padding:3px 8px">ESPECIFICACIONES DE TELA</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <thead><tr>
        <th style="border:1px solid #1a3a6b;padding:3px 8px;background:#fef3e2;font-size:9px;font-weight:700;color:#92400e;text-align:left;width:200px">Tipo de tela</th>
        <th style="border:1px solid #1a3a6b;padding:3px 2px;background:#fef3e2;font-size:9px;font-weight:700;color:#92400e;text-align:center;width:160px">Metros usados</th>
        <th style="border:1px solid #1a3a6b;padding:3px 2px;background:#fef3e2;font-size:9px;font-weight:700;color:#dc2626;text-align:center;width:160px">Metros desechados</th>
        <th style="border:1px solid #1a3a6b;padding:3px 2px;background:#fef3e2;font-size:8px;font-weight:700;color:#92400e;text-align:center;font-style:italic">Comentarios</th>
      </tr></thead>
      <tbody>${espRows}</tbody>
    </table>
    <div style="border-top:1px solid #1a3a6b;padding:7px 12px;display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;font-weight:700;color:#1a3a6b;white-space:nowrap">NOTA:</span>
      <span style="flex:1;border-bottom:1px solid #1a3a6b;min-height:18px;display:inline-block;font-size:11px;padding:0 4px">${fc.nota||''}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #1a3a6b">
      ${firmaBox('Entregado por (Corte)', fc.firmaCorte, fc.nombreCorte, fc.fechaCorte)}
      <div style="border-left:1px solid #1a3a6b">
      ${firmaBox('Recibido por (Admin ELROHI)', fc.firmaAdmin, fc.nombreAdmin, fc.fechaAdmin)}
      </div>
    </div>
  </div>
  <script>window.onload=()=>window.print();</script>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

// ─── CORTE SCREEN ─────────────────────────────────────────────────────────────
export function CorteScreen() {
  const { lots, clients } = useData();
  const { profile }       = useAuth();
  const [tab, setTab]     = useState('cola');
  const queue = lots.filter((l) => ['activacion', 'corte'].includes(l.status));

  const advance = async (lot, action) => {
    try { await advanceLot(lot, action, []); toast.success('Lote actualizado'); }
    catch { toast.error('Error al actualizar'); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Área de Corte</h1>
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['cola','Cola de Corte'],['formato','Formato de Corte']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'cola' && (
        <div>
          {queue.length === 0 && <EmptyState emoji="✂" title="Sin lotes en cola" sub="Sin lotes pendientes de corte 🎉" />}
          <div className="space-y-3">
            {queue.map((l) => (
              <LotCard key={l.id} lot={l} clients={clients} accentColor="#ea580c">
                <div className="flex flex-col gap-2">
                  {l.status === 'activacion' && (
                    <button onClick={() => advance(l, 'a_corte')}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600">
                      ▶ Activar Corte
                    </button>
                  )}
                  {l.status === 'corte' && (
                    <button onClick={() => advance(l, 'a_asignacion')}
                      className="px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700">
                      ✓ Corte Listo
                    </button>
                  )}
                </div>
              </LotCard>
            ))}
          </div>
        </div>
      )}

      {tab === 'formato' && <FormatoCorteTab lots={lots} clients={clients} profile={profile} />}
    </div>
  );
}

// ─── FORMATO DE CORTE TAB ─────────────────────────────────────────────────────
function FormatoCorteTab({ lots, clients, profile }) {
  const [subtab, setSubtab] = useState('nuevo');
  const [formatosCorte, setFormatosCorte] = useState([]);

  useEffect(() => {
    const unsub = listenCol('formatosCorte', setFormatosCorte, orderBy('createdAt','desc'));
    return unsub;
  }, []);

  const pendientes = formatosCorte.filter(f => f.status === 'enviado' && ['gerente','admin_elrohi'].includes(profile?.role));

  return (
    <div>
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['nuevo','Nuevo Formato'],
          ...((['gerente','admin_elrohi'].includes(profile?.role)) ? [['pendientes',`Pendientes (${pendientes.length})`]] : []),
          ['historial','Historial']
        ].map(([k,l])=>(
          <button key={k} onClick={()=>setSubtab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:subtab===k?'#fff':'transparent',color:subtab===k?'#111827':'#6b7280',fontWeight:subtab===k?700:400,boxShadow:subtab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {subtab === 'nuevo'      && <NuevoFormato lots={lots} clients={clients} profile={profile} />}
      {subtab === 'pendientes' && <PendientesFormato formatosCorte={pendientes} profile={profile} />}
      {subtab === 'historial'  && <HistorialFormatos formatosCorte={formatosCorte} profile={profile} />}
    </div>
  );
}

// ─── NUEVO FORMATO ────────────────────────────────────────────────────────────
function NuevoFormato({ lots, clients, profile }) {
  const activeLots = lots.filter(l => ['activacion','corte'].includes(l.status));
  const [selLotId,  setSelLotId]  = useState('');
  const [numCorte,  setNumCorte]  = useState('18');
  const [cortesRef, setCortesRef] = useState(Array(5).fill(''));
  const [comentRef, setComentRef] = useState(Array(5).fill(''));
  const [specs,     setSpecs]     = useState(Array(4).fill(null).map(()=>({tipoTela:'',metrosUsados:'',metrosDesechados:'',comentario:''})));
  const [nota,      setNota]      = useState('');
  const [firmaImg,  setFirmaImg]  = useState(null);
  const [nombre,    setNombre]    = useState(profile?.name||'');
  const [saving,    setSaving]    = useState(false);

  const selLot  = lots.find(l => l.id === selLotId);
  const nombreDoc = genNombre(numCorte);
  const updSpec = (i,f,v) => { const n=[...specs]; n[i]={...n[i],[f]:v}; setSpecs(n); };

  const enviar = async () => {
    if (!selLot)  { toast.error('Selecciona un lote'); return; }
    if (!firmaImg){ toast.error('Dibuja y guarda tu firma'); return; }
    if (!nombre)  { toast.error('Escribe tu nombre'); return; }
    setSaving(true);
    try {
      await addDocument('formatosCorte', {
        nombreDoc,
        numCorte:      String(numCorte).padStart(4,'0'),
        lotId:         selLot.id,
        lotCode:       selLot.code,
        status:        'enviado',
        date:          todayISO(),
        lot:           selLot,
        cortesRef,
        comentariosRef: comentRef,
        especificaciones: specs,
        nota,
        operarioNombre:  nombre,
        firmaCorte:      firmaImg,
        fechaCorte:      nowStr(),
        firmaAdmin:      null,
        nombreAdmin:     null,
        fechaAdmin:      null,
      });
      toast.success(`✅ Formato ${nombreDoc} enviado`);
      setSelLotId(''); setFirmaImg(null);
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
              {activeLots.map(l=><option key={l.id} value={l.id}>{l.code} · {cLabel(clients,l.clientId)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Número de corte</label>
            <input value={numCorte} onChange={e=>setNumCorte(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-400" style={{color:'#e85d26'}} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del documento</label>
            <div className="w-full border border-gray-100 rounded-lg px-3 py-2 text-xs font-bold bg-gray-50 font-mono" style={{color:'#1a3a6b'}}>{nombreDoc}</div>
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
                  <th className="border border-blue-200 px-1 py-1.5 text-[9px] font-bold" style={{background:'#dce6f5',color:'#1a3a6b',width:'46px'}}>TOTAL</th>
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
                      <input type="text" value={cortesRef[i]||''} onChange={e=>{const n=[...cortesRef];n[i]=e.target.value;setCortesRef(n);}} placeholder="590"
                        className="w-full text-center text-xs font-bold outline-none bg-transparent" style={{color:'#e85d26'}} />
                    </td>
                    <td className="border border-blue-100 px-1 py-1" style={{background:'#fdfbff'}}>
                      <input type="text" value={comentRef[i]||''} onChange={e=>{const n=[...comentRef];n[i]=e.target.value;setComentRef(n);}} placeholder="Obs..."
                        className="w-full text-xs italic outline-none bg-transparent" style={{color:'#4a3a6b'}} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Especificaciones de Tela */}
        <div className="bg-white rounded-xl border border-orange-100 p-4 mb-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{color:'#92400e'}}>Especificaciones de Tela</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{tableLayout:'fixed'}}>
              <thead>
                <tr style={{background:'#fef3e2'}}>
                  <th className="border border-orange-200 px-2 py-1.5 text-left text-[10px] font-bold" style={{color:'#92400e',width:'200px'}}>Tipo de tela</th>
                  <th className="border border-orange-200 px-1 py-1.5 text-[10px] font-bold" style={{color:'#92400e',width:'130px'}}>Metros usados</th>
                  <th className="border border-orange-200 px-1 py-1.5 text-[10px] font-bold" style={{color:'#dc2626',width:'130px'}}>Metros desechados</th>
                  <th className="border border-orange-200 px-1 py-1.5 text-[9px] font-bold italic" style={{color:'#92400e',background:'#fdfbff'}}>Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((sp,i)=>(
                  <tr key={i}>
                    <td className="border border-orange-100 px-1 py-1">
                      <input value={sp.tipoTela} onChange={e=>updSpec(i,'tipoTela',e.target.value)} placeholder={`Tipo de tela ${i+1}`}
                        className="w-full text-xs font-medium outline-none bg-transparent" style={{color:'#1a3a6b'}} />
                    </td>
                    <td className="border border-orange-100 px-1 py-1">
                      <input value={sp.metrosUsados} onChange={e=>updSpec(i,'metrosUsados',e.target.value)} placeholder="0.00"
                        className="w-full text-center text-xs font-semibold outline-none bg-transparent" style={{color:'#1a3a6b'}} />
                    </td>
                    <td className="border border-orange-100 px-1 py-1">
                      <input value={sp.metrosDesechados} onChange={e=>updSpec(i,'metrosDesechados',e.target.value)} placeholder="0.00"
                        className="w-full text-center text-xs font-semibold outline-none bg-transparent" style={{color:'#dc2626'}} />
                    </td>
                    <td className="border border-orange-100 px-1 py-1" style={{background:'#fdfbff'}}>
                      <input value={sp.comentario} onChange={e=>updSpec(i,'comentario',e.target.value)} placeholder="Obs..."
                        className="w-full text-xs italic outline-none bg-transparent" style={{color:'#4a3a6b'}} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nota */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <label className="text-xs font-semibold text-gray-600 block mb-1">NOTA:</label>
          <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Observaciones generales del corte..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
        </div>

        {/* Firma Corte */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tu firma — "Entregado por Corte"</p>
            {firmaImg && <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded-full">✓ Firma guardada</span>}
          </div>
          <FirmaCanvas label="Dibuja tu firma:" onSave={setFirmaImg} />
          <div className="mt-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tu nombre completo</label>
            <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Escribe tu nombre..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>
        </div>

        <button onClick={enviar} disabled={saving}
          className="w-full py-3 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90"
          style={{background:'#1a3a6b'}}>
          {saving ? 'Guardando...' : '📤 Enviar Formato al Admin ELROHI'}
        </button>
      </>)}

      {!selLot && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">✂</p>
          <p className="font-medium text-gray-700">Selecciona un lote arriba</p>
          <p className="text-sm text-gray-400 mt-1">El formato se llenará con los datos del lote</p>
        </div>
      )}
    </div>
  );
}

// ─── PENDIENTES (Admin ELROHI firma como recibido) ────────────────────────────
function PendientesFormato({ formatosCorte, profile }) {
  const [sel,      setSel]      = useState(null);
  const [firmaImg, setFirmaImg] = useState(null);
  const [nombre,   setNombre]   = useState(profile?.name||'');
  const [saving,   setSaving]   = useState(false);

  const firmar = async (fc) => {
    if (!firmaImg){ toast.error('Dibuja y guarda tu firma'); return; }
    if (!nombre)  { toast.error('Escribe tu nombre'); return; }
    setSaving(true);
    try {
      await updateDocument('formatosCorte', fc.id, {
        status:      'completado',
        firmaAdmin:  firmaImg,
        nombreAdmin: nombre,
        fechaAdmin:  nowStr(),
      });
      toast.success('✅ Formato firmado y archivado');
      setSel(null); setFirmaImg(null);
    } catch { toast.error('Error al firmar'); }
    finally { setSaving(false); }
  };

  if (formatosCorte.length === 0) return (
    <EmptyState emoji="✅" title="Sin formatos pendientes" sub="No hay formatos de corte por firmar" />
  );

  return (
    <div className="space-y-3">
      {formatosCorte.map(fc=>(
        <div key={fc.id} className="bg-white rounded-xl border-2 border-amber-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-xs font-bold" style={{color:'#1a3a6b'}}>{fc.nombreDoc}</span>
                <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">⏳ Pendiente tu firma</span>
              </div>
              <p className="text-xs text-gray-500">Lote: {fc.lotCode} · {fc.date}</p>
              <p className="text-xs text-gray-500">Operario: {fc.operarioNombre}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>printFormato(fc, fc.nombreDoc)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">🖨️ Ver</button>
              <button onClick={()=>setSel(sel?.id===fc.id?null:fc)}
                className="text-xs px-3 py-1.5 rounded-lg text-white font-bold" style={{background:'#1a3a6b'}}>✍ Firmar</button>
            </div>
          </div>
          {sel?.id === fc.id && (
            <div className="border-t border-amber-100 pt-3 mt-2">
              <FirmaCanvas label="Tu firma de recepción:" onSave={setFirmaImg} />
              <div className="mt-2 mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tu nombre completo</label>
                <input value={nombre} onChange={e=>setNombre(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <button onClick={()=>firmar(fc)} disabled={saving}
                className="w-full py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50" style={{background:'#15803d'}}>
                {saving?'Guardando...':'✅ Confirmar recepción y firmar'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── HISTORIAL ────────────────────────────────────────────────────────────────
function HistorialFormatos({ formatosCorte, profile }) {
  if (formatosCorte.length === 0) return (
    <EmptyState emoji="📋" title="Sin formatos registrados" sub="Los formatos enviados aparecerán aquí" />
  );
  return (
    <div className="space-y-2">
      {formatosCorte.map(fc=>(
        <div key={fc.id} className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-xs font-bold" style={{color:'#1a3a6b'}}>{fc.nombreDoc}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${fc.status==='completado'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                  {fc.status==='completado'?'✓ Completado':'⏳ Pendiente firma admin'}
                </span>
              </div>
              <p className="text-xs text-gray-500">Lote: {fc.lotCode} · {fc.date} · Operario: {fc.operarioNombre}</p>
            </div>
            <button onClick={()=>printFormato(fc, fc.nombreDoc)}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">🖨️ Imprimir</button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="text-xs">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Entregado por (Corte)</p>
              {fc.firmaCorte && <img src={fc.firmaCorte} alt="firma" style={{height:28,borderBottom:'1px solid #e5e7eb',marginBottom:2,maxWidth:'100%'}} />}
              <p className="font-medium text-gray-700">{fc.operarioNombre||'—'}</p>
              <p className="text-[9px] text-gray-400">{fc.fechaCorte||'—'}</p>
            </div>
            <div className="text-xs">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Recibido por (Admin ELROHI)</p>
              {fc.firmaAdmin ? <>
                <img src={fc.firmaAdmin} alt="firma" style={{height:28,borderBottom:'1px solid #e5e7eb',marginBottom:2,maxWidth:'100%'}} />
                <p className="font-medium text-gray-700">{fc.nombreAdmin}</p>
                <p className="text-[9px] text-gray-400">{fc.fechaAdmin}</p>
              </> : <p className="text-gray-300 italic text-[10px]">Pendiente</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── TINTORERÍA ──────────────────────────────────────────────────────────────
export function TintoriaScreen() {
  const { lots, clients } = useData();
  const queue = lots.filter((l) => l.status === 'tintoreria');
  const advance = async (lot) => {
    try { await advanceLot(lot, 'de_tintoreria', []); toast.success('Lote enviado a validación'); }
    catch { toast.error('Error al actualizar'); }
  };
  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Área de Tintorería</h1>
      {queue.length === 0 && <EmptyState emoji="🎨" title="Sin lotes en tintorería" sub="No hay lotes en proceso de tinte actualmente" />}
      <div className="space-y-3">
        {queue.map((l) => (
          <LotCard key={l.id} lot={l} clients={clients} accentColor="#4f46e5">
            <button onClick={() => advance(l)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
              ✓ Proceso Listo
            </button>
          </LotCard>
        ))}
      </div>
    </div>
  );
}

// ─── PESPUNTE ────────────────────────────────────────────────────────────────
export function PespunteScreen() {
  const { lots, clients } = useData();
  const queue = lots.filter((l) => l.status === 'pespunte');
  const advance = async (lot) => {
    try { await advanceLot(lot, 'a_bodega', []); toast.success('Lote ingresado a bodega'); }
    catch { toast.error('Error al actualizar'); }
  };
  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Área de Pespunte</h1>
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-4 text-xs text-pink-700">
        🪡 Operaciones: <strong>Planchar → Poner botones → Doblar → Empacar</strong>
      </div>
      {queue.length === 0 && <EmptyState emoji="🪡" title="Sin lotes en pespunte" sub="No hay lotes pendientes de terminación" />}
      <div className="space-y-3">
        {queue.map((l) => (
          <LotCard key={l.id} lot={l} clients={clients} accentColor="#db2777">
            <button onClick={() => advance(l)} className="px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600">
              📦 Enviar a Bodega
            </button>
          </LotCard>
        ))}
      </div>
    </div>
  );
}

// ─── BODEGA ──────────────────────────────────────────────────────────────────
export function BodegaScreen() {
  const { lots, clients } = useData();
  const inBodega   = lots.filter((l) => l.status === 'bodega');
  const dispatched = lots.filter((l) => l.status === 'despachado');
  const dispatch = async (lot) => {
    try { await advanceLot(lot, 'despachar', []); toast.success('Lote despachado al cliente'); }
    catch { toast.error('Error al despachar'); }
  };
  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-4">Bodega — Stock y Despacho</h1>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[['Lotes en bodega',inBodega.length,'Listos para despacho'],
          ['Piezas disponibles',inBodega.reduce((a,l)=>a+l.totalPieces,0).toLocaleString('es-CO'),''],
          ['Despachados',dispatched.length,'Historial total']].map(([l,v,s])=>(
          <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-black text-gray-900">{v}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{l}</p>
            {s&&<p className="text-[9px] text-gray-300">{s}</p>}
          </div>
        ))}
      </div>
      {inBodega.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Listos para despacho</p>
          <div className="space-y-2">
            {inBodega.map(l=>(
              <LotCard key={l.id} lot={l} clients={clients} accentColor="#16a34a">
                <div>
                  {l.novelties?.length>0&&<p className="text-[9px] text-red-500 font-semibold mb-1">⚠ {l.novelties.length} novedad{l.novelties.length>1?'es':''}</p>}
                  <button onClick={()=>dispatch(l)} className="px-4 py-2 text-white rounded-lg text-xs font-bold" style={{background:ACCENT}}>🚚 Despachar</button>
                </div>
              </LotCard>
            ))}
          </div>
        </div>
      )}
      {dispatched.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Historial de despachos</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-gray-50">{['Código','Cliente','Piezas','Vence'].map(c=><th key={c} className="text-left px-3 py-2 text-[10px] text-gray-400 font-medium">{c}</th>)}</tr></thead>
              <tbody>
                {dispatched.map(l=>(
                  <tr key={l.id} className="border-t border-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-400">{l.code}</td>
                    <td className="px-3 py-2 text-gray-600">{cLabel(clients,l.clientId)}</td>
                    <td className="px-3 py-2 text-gray-600">{l.totalPieces?.toLocaleString('es-CO')}</td>
                    <td className="px-3 py-2 text-gray-400">{l.deadline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {inBodega.length===0&&dispatched.length===0&&<EmptyState emoji="📫" title="Bodega vacía" sub="Los lotes completados aparecerán aquí" />}
    </div>
  );
}
