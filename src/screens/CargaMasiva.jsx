import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { ACCENT } from '../constants';
// xlsx se carga dinámicamente desde CDN
const getXLSX = () => new Promise((resolve) => {
  if (window.XLSX) { resolve(window.XLSX); return; }
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  script.onload = () => resolve(window.XLSX);
  document.head.appendChild(script);
});
import toast from 'react-hot-toast';

// ── TEMPLATES DE DESCARGA ─────────────────────────────────────────────────────
const downloadTemplate = async (tipo) => {
  const XLSX = await getXLSX();
  let headers, ejemplo, nombre;
  if (tipo === 'clientes') {
    headers = ['RAZON_SOCIAL','NIT','DIRECCION','TELEFONO','CIUDAD','FORMA_PAGO','IMPUESTO'];
    ejemplo = [['EMPRESA SAS','900123456','Calle 10 # 5-20','3001234567','Bogotá','Contado','IVA']];
    nombre = 'Plantilla_Clientes_ELROHI.xlsx';
  } else if (tipo === 'operarios') {
    headers = ['NOMBRE','APELLIDO','CEDULA','TELEFONO','EMAIL','ROL','TIPO_SALARIO','SALARIO_FIJO'];
    ejemplo = [['Juan','Pérez','12345678','3001234567','jperez@elrohi.com','terminacion','fijo_mas_ops','1600000']];
    nombre = 'Plantilla_Operarios_ELROHI.xlsx';
  } else if (tipo === 'satelite_operarios') {
    headers = ['NOMBRE','CEDULA','TELEFONO','EMAIL'];
    ejemplo = [['María García','87654321','3109876543','mgarcia@taller.com']];
    nombre = 'Plantilla_OperariosSatelite_ELROHI.xlsx';
  } else if (tipo === 'operaciones') {
    headers = ['NOMBRE_OPERACION','VALOR_UNITARIO'];
    ejemplo = [['Pegar cremallera','800'],['Pegar botones','400'],['Doblar','300']];
    nombre = 'Plantilla_Operaciones_ELROHI.xlsx';
  }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...ejemplo]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, nombre);
};

// ── PARSEAR EXCEL ──────────────────────────────────────────────────────────────
const parseExcel = (file) => new Promise(async (resolve, reject) => {
  const XLSX = await getXLSX();
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'binary' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
      resolve(data);
    } catch(err) { reject(err); }
  };
  reader.onerror = reject;
  reader.readAsBinaryString(file);
});

// ── NORMALIZAR CAMPOS ──────────────────────────────────────────────────────────
const normFormaPago = (v) => {
  const s = String(v).toLowerCase().trim();
  if (s.includes('cred')) return 'credito';
  return 'contado';
};
const normImpuesto = (v) => {
  const s = String(v).toLowerCase().trim();
  if (s.includes('mayor')) return 'remision_mayorista';
  if (s.includes('iva'))   return 'iva';
  return 'ninguno';
};
const normRol = (v) => {
  const s = String(v).toLowerCase().trim();
  if (s.includes('termin') || s.includes('calidad')) return 'terminacion';
  if (s.includes('bodega')) return 'bodega_op';
  if (s.includes('corte'))  return 'corte';
  if (s.includes('desp'))   return 'despachos';
  return 'terminacion';
};
const normSalario = (v) => {
  const s = String(v).toLowerCase().trim();
  if (s.includes('fijo_mas') || s.includes('fijo +') || s.includes('mixto')) return 'fijo_mas_ops';
  if (s.includes('fijo'))     return 'solo_fijo';
  return 'solo_operaciones';
};

export default function CargaMasivaScreen() {
  const { profile } = useAuth();
  const [tab,       setTab]       = useState('clientes');
  const [preview,   setPreview]   = useState([]);
  const [errors,    setErrors]    = useState([]);
  const [saving,    setSaving]    = useState(false);
  const [resultado, setResultado] = useState(null);
  const [file,      setFile]      = useState(null);

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);

  const handleFile = async (e, tipo) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResultado(null);
    setErrors([]);
    try {
      const rows = await parseExcel(f);
      if (rows.length === 0) { toast.error('El archivo está vacío'); return; }

      let parsed = [];
      let errs   = [];

      if (tipo === 'clientes') {
        parsed = rows.map((r, i) => {
          const nombre = r.RAZON_SOCIAL || r['RAZÓN SOCIAL'] || r.NOMBRE || r.nombre || '';
          const nit    = String(r.NIT || r.nit || '').trim();
          if (!nombre) errs.push(`Fila ${i+2}: falta Razón Social`);
          if (!nit)    errs.push(`Fila ${i+2}: falta NIT`);
          return {
            nombre:    nombre.trim(),
            nit:       nit,
            direccion: String(r.DIRECCION || r.DIRECCIÓN || r.direccion || '').trim(),
            telefono:  String(r.TELEFONO || r.telefono || '').trim(),
            ciudad:    String(r.CIUDAD || r.ciudad || '').trim(),
            formaPago: normFormaPago(r.CONDICION || r.CONDICIÓN || r.FORMA_PAGO || r.formaPago || ''),
            impuesto:  normImpuesto(r['TIPO DOC'] || r.IMPUESTO || r.impuesto || ''),
            active:    true,
          };
        });
      } else if (tipo === 'operarios') {
        parsed = rows.map((r, i) => {
          const nombre = String(r.NOMBRE || '').trim();
          const ap     = String(r.APELLIDO || '').trim();
          if (!nombre) errs.push(`Fila ${i+2}: falta Nombre`);
          return {
            name:        `${nombre} ${ap}`.trim(),
            cedula:      String(r.CEDULA || r.cédula || '').trim(),
            telefono:    String(r.TELEFONO || '').trim(),
            email:       String(r.EMAIL || '').trim().toLowerCase(),
            role:        normRol(r.ROL || r.rol || ''),
            salarioTipo: normSalario(r.TIPO_SALARIO || r.tipo_salario || ''),
            salarioFijo: +String(r.SALARIO_FIJO || r.salario_fijo || '0').replace(/\D/g,'') || 0,
            initials:    `${nombre.charAt(0)}${ap.charAt(0)}`.toUpperCase(),
            active:      true,
            satId:       null,
          };
        });
      } else if (tipo === 'operaciones') {
        parsed = rows.map((r, i) => {
          const nombre = String(r.NOMBRE_OPERACION || r.nombre || r.NOMBRE || '').trim();
          const val    = +String(r.VALOR_UNITARIO || r.valor || '0').replace(/\D/g,'') || 0;
          if (!nombre) errs.push(`Fila ${i+2}: falta nombre de operación`);
          return { name: nombre, val, active: true };
        });
      } else if (tipo === 'listas_precios') {
        // Formato: # | DESCRIPCIÓN PRODUCTO | TALLAS | PRECIO | TIPO
        // Agrupar productos — mismo # = mismo producto con diferentes tallas/precios
        const productosMap = {};
        rows.forEach((r, i) => {
          const num   = String(r['#'] || r.NUM || r.num || '').trim();
          const desc  = String(r['DESCRIPCIÓN PRODUCTO'] || r['DESCRIPCION PRODUCTO'] || r.DESCRIPCION || r.descripcion || '').trim();
          const talla = String(r.TALLAS || r.talla || r.TALLA || '').trim();
          const tipo2 = String(r.TIPO || r.tipo || '').trim();
          const precioStr = String(r.PRECIO || r.precio || '0').replace(/[^\d]/g,'');
          const precio = +precioStr || 0;
          if (!desc && !num) return;
          const key = num || desc.slice(0,30);
          if (!productosMap[key]) {
            productosMap[key] = { num, descripcion: desc, tipo: tipo2, precios: [], active: true };
          }
          if (talla && precio > 0) {
            productosMap[key].precios.push({ talla, precio });
          }
        });
        parsed = Object.values(productosMap).filter(p => p.descripcion && p.precios.length > 0);
        if (parsed.length === 0) errs.push('No se encontraron productos válidos');
      }

      setErrors(errs);
      setPreview(parsed);
      if (errs.length === 0) toast.success(`✅ ${parsed.length} registros listos para cargar`);
      else toast.error(`${errs.length} errores encontrados — revisa antes de cargar`);
    } catch(err) {
      toast.error('Error al leer el archivo');
      console.error(err);
    }
  };

  const cargar = async (tipo) => {
    if (preview.length === 0) { toast.error('Primero selecciona un archivo'); return; }
    if (errors.length > 0) { toast.error('Corrige los errores antes de cargar'); return; }
    setSaving(true);
    let ok = 0; let fail = 0;
    try {
      const col = tipo === 'clientes'      ? 'clients' :
                  tipo === 'operarios'     ? 'users' :
                  tipo === 'listas_precios'? 'listasPrecios' : 'operations';

      if (tipo === 'listas_precios') {
        // Para listas de precios: el nombre de la lista viene del input del usuario
        const nombreLista = window.prompt('¿Nombre de esta lista de precios?\nEj: Lista Contado IVA');
        if (!nombreLista) { setSaving(false); return; }
        const descripcion = window.prompt('Descripción (opcional)\nEj: Clientes contado con IVA') || '';
        // Guardar todos los productos en una sola lista
        try {
          await addDocument('listasPrecios', {
            nombre: nombreLista,
            descripcion,
            productos: preview,
            active: true,
          });
          ok = preview.length;
        } catch { fail = 1; }
      } else {
        for (const item of preview) {
          try {
            await addDocument(col, item);
            ok++;
          } catch { fail++; }
        }
      }
      setResultado({ ok, fail, tipo });
      setPreview([]); setFile(null);
      toast.success(`✅ ${ok} registros cargados${fail>0?` · ${fail} fallaron`:''}`);
    } catch(e) { console.error(e); toast.error('Error al cargar'); }
    finally { setSaving(false); }
  };

  const TABS = [
    { key:'clientes',      label:'🏢 Clientes',       col:'clients',       desc:'Carga masiva de clientes desde CSV' },
    { key:'operarios',     label:'👷 Operarios',      col:'users',         desc:'Carga masiva de operarios ELROHI' },
    { key:'operaciones',   label:'⚡ Operaciones',    col:'operations',    desc:'Carga masiva de operaciones de costura' },
    { key:'listas_precios',label:'💰 Listas Precios', col:'listasPrecios', desc:'Carga masiva de listas de precios por referencia' },
  ];

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-1">Carga Masiva</h1>
      <p className="text-xs text-gray-400 mb-4">Importa clientes, operarios y operaciones desde archivos Excel</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>{ setTab(t.key); setPreview([]); setErrors([]); setResultado(null); setFile(null); }}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===t.key?'#fff':'transparent',color:tab===t.key?'#111827':'#6b7280',
              fontWeight:tab===t.key?700:400,boxShadow:tab===t.key?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {t.label}
          </button>
        ))}
      </div>

      {TABS.filter(t=>t.key===tab).map(t=>(
        <div key={t.key}>
          {/* Instrucciones */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-bold text-blue-800 mb-2">📋 Instrucciones</p>
            <p className="text-[10px] text-blue-700 mb-2">{t.desc}. Descarga la plantilla CSV, llena los datos en Excel y guarda como CSV antes de subir.</p>
            <button onClick={()=>downloadTemplate(t.key)}
              className="text-[10px] font-bold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              ⬇ Descargar plantilla Excel
            </button>
          </div>

          {/* Upload */}
          <div className="mb-4">
            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
              {file ? (
                <div className="text-center">
                  <p className="text-2xl mb-1">📊</p>
                  <p className="text-sm font-bold text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{preview.length} registros encontrados</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-3xl mb-2">📂</p>
                  <p className="text-sm font-medium text-gray-600">Clic para seleccionar archivo Excel</p>
                  <p className="text-xs text-gray-400 mt-1">.xlsx o .xls</p>
                </div>
              )}
              <input type="file" accept=".csv,.txt" onChange={e=>handleFile(e,t.key)} className="hidden" />
            </label>
          </div>

          {/* Errores */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-red-700 mb-1">⚠ {errors.length} errores encontrados:</p>
              {errors.map((e,i)=><p key={i} className="text-[10px] text-red-600">{e}</p>)}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && errors.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
                style={{background:'#1a3a6b'}}>
                <p className="text-[10px] font-bold text-white uppercase tracking-wider">
                  Vista previa — {preview.length} registros
                </p>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      {Object.keys(preview[0]).filter(k=>k!=='active'&&k!=='satId'&&k!=='initials').map(k=>(
                        <th key={k} className="px-3 py-2 text-left text-gray-500 font-medium border-b border-gray-100 whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0,10).map((row,i)=>(
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        {Object.entries(row).filter(([k])=>k!=='active'&&k!=='satId'&&k!=='initials').map(([k,v])=>(
                          <td key={k} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 10 && (
                <p className="text-[10px] text-gray-400 text-center py-2">... y {preview.length-10} más</p>
              )}
            </div>
          )}

          {/* Resultado */}
          {resultado && resultado.tipo === t.key && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-black text-green-700">✅ Carga completada</p>
              <p className="text-xs text-green-600 mt-1">{resultado.ok} registros cargados exitosamente{resultado.fail>0?` · ${resultado.fail} fallaron`:''}</p>
            </div>
          )}

          {/* Botón cargar */}
          {preview.length > 0 && errors.length === 0 && (
            <button onClick={()=>cargar(t.key)} disabled={saving}
              className="w-full py-3 text-white text-sm font-bold rounded-xl disabled:opacity-50"
              style={{background:ACCENT}}>
              {saving?'Cargando...':`📤 Cargar ${preview.length} ${t.key} a ELROHI`}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
