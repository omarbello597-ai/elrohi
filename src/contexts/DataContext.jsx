import { createContext, useContext, useEffect, useState } from 'react';
import {
  listenUsers, listenSatellites, listenOperations,
  listenSatOpVals, listenLots, listenSupplies, listenPayments,
  listenClients, listenCol,
  setSatOpVal as dbSetSatOpVal,
} from '../services/db';
import { orderBy } from 'firebase/firestore';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [users,       setUsers]       = useState([]);
  const [satellites,  setSatellites]  = useState([]);
  const [ops,         setOps]         = useState([]);
  const [satOpVals,   setSatOpVals]   = useState({});
  const [lots,        setLots]        = useState([]);
  const [supplies,    setSupplies]    = useState([]);
  const [payments,    setPayments]    = useState([]);
  const [clients,     setClients]     = useState([]);
  const [listas,      setListas]      = useState([]);
  const [inventario,  setInventario]  = useState([]);
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
      listenClients(setClients),
      listenCol('listasPrecios', setListas, orderBy('createdAt','desc')),
      listenCol('inventario',    setInventario),
    ];
    return () => unsubs.forEach(u => u && u());
  }, []);

  const updateSatOpVal = (satId, opId, val) => dbSetSatOpVal(satId, opId, val);

  return (
    <DataContext.Provider value={{
      users, satellites, ops, satOpVals, updateSatOpVal,
      lots, supplies, payments, clients, listas, inventario, ready,
      orders: [],
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
