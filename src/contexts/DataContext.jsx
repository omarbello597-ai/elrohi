import { createContext, useContext, useEffect, useState } from 'react';
import {
  listenUsers, listenSatellites, listenOperations,
  listenSatOpVals, listenLots, listenSupplies, listenPayments,
  setSatOpVal as dbSetSatOpVal,
} from '../services/db';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [users,       setUsers]       = useState([]);
  const [satellites,  setSatellites]  = useState([]);
  const [ops,         setOps]         = useState([]);
  const [satOpVals,   setSatOpVals]   = useState({});
  const [lots,        setLots]        = useState([]);
  const [supplies,    setSupplies]    = useState([]);
  const [payments,    setPayments]    = useState([]);
  const [ready,       setReady]       = useState(false);

  useEffect(() => {
    const unsubs = [
      listenUsers(setUsers),
      listenSatellites(setSatellites),
      listenOperations(setOps),
      listenSatOpVals(setSatOpVals),
      listenLots((data) => { setLots(data); setReady(true); }),
      listenSupplies(setSupplies),
      listenPayments(setPayments),
    ];
    return () => unsubs.forEach(u => u && u());
  }, []);

  const updateSatOpVal = (satId, opId, val) => dbSetSatOpVal(satId, opId, val);

  return (
    <DataContext.Provider value={{
      users, satellites, ops, satOpVals, updateSatOpVal,
      lots, supplies, payments, ready,
      // Compatibilidad — arrays vacíos para evitar errores en pantallas antiguas
      clients: [], orders: [], invGarments: {},
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
