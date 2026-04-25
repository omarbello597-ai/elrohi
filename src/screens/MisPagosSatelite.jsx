import { useState, useEffect } from 'react';
import { useAuth }   from '../contexts/AuthContext';
import { listenCol } from '../services/db';
import { fmtM }      from '../utils';
import { orderBy }   from 'firebase/firestore';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function MisPagosSateliteScreen() {
  const { profile } = useAuth();
  const [pagos, setPagos] = useState([]);

  useEffect(()=>{
    const unsub = listenCol('pagosSatelite', setPagos, orderBy('createdAt','desc'));
    return unsub;
  },[]);

  const misPagos = pagos.filter(p=>p.satId===profile?.satId);

  // Agrupar por mes
  const porMes = misPagos.reduce((acc, p)=>{
    const fecha = p.fechaPago || p.date || '';
    const d = new Date(fecha);
    const mes = isNaN(d.getTime()) ? 'Sin fecha' : `${MESES[d.getMonth()]} ${d.getFullYear()}`;
    if (!acc[mes]) acc[mes] = [];
    acc[mes].push(p);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-1">Mis Pagos</h1>
      <p className="text-xs text-gray-400 mb-4">Pagos recibidos de ELROHI</p>

      {misPagos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-3xl mb-2">💰</p>
          <p className="font-medium text-gray-700">Sin pagos registrados</p>
          <p className="text-xs text-gray-400 mt-1">Aquí aparecerán los pagos que ELROHI registre para tu taller</p>
        </div>
      )}

      {Object.entries(porMes).map(([mes, items])=>(
        <div key={mes} className="mb-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{mes}</p>
          <div className="space-y-3">
            {items.map(p=>(
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-blue-700">{p.recId}</span>
                      <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✅ Pagado</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{p.periodo}</p>
                    <p className="text-[10px] text-gray-400">Pagado por: {p.pagadoPor} · {p.fechaPago}</p>
                  </div>
                  <p className="text-xl font-black text-green-700 flex-shrink-0">{fmtM(p.total)}</p>
                </div>

                {/* Detalle de operaciones */}
                {(p.opsDetalle||[]).length>0 && (
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-gray-100">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Detalle de operaciones</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {p.opsDetalle.map((f,i)=>(
                        <div key={i} className="px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-[10px] font-mono font-bold text-blue-700">{f.lotCode}</p>
                              <p className="text-[10px] text-gray-700">{f.descripcion}</p>
                              <p className="text-[10px] text-gray-500">
                                <strong>{f.operacion}</strong> · {(f.qty||0).toLocaleString('es-CO')} und × {fmtM(f.valUnit)}
                              </p>
                            </div>
                            <span className="text-xs font-black text-gray-900 flex-shrink-0">{fmtM(f.subtotal)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 bg-gray-50 flex justify-between border-t border-gray-100">
                      <span className="text-xs font-bold text-gray-700">TOTAL</span>
                      <span className="text-sm font-black text-green-700">{fmtM(p.total)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
