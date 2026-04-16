import { createContext, useContext, useEffect, useState } from 'react';
import {
  listenUsers, listenClients, listenSatellites, listenOperations,
  listenSatOpVals, listenOrders, listenLots, listenSupplies,
  listenInventoryGarments, listenPayments,
  setSatOpVal as dbSetSatOpVal,
} from '../services/db';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [users,       setUsers]       = useState([]);
  const [clients,     setClients]     = useState([]);
  const [satellites,  setSatellites]  = useState([]);
  const [ops,         setOps]         = useState([]);
  const [satOpVals,   setSatOpVals]   = useState({});
  const [orders,      setOrders]      = useState([]);
  const [lots,        setLots]        = useState([]);
  const [supplies,    setSupplies]    = useState([]);
  const [invGarments, setInvGarments] = useState({});
  const [payments,    setPayments]    = useState([]);
  const [ready,       setReady]       = useState(false);

  useEffect(() => {
    // Subscribe to all collections at once
    const unsubs = [
      listenUsers(setUsers),
      listenClients(setClients),
      listenSatellites(setSatellites),
      listenOperations(setOps),
      listenSatOpVals(setSatOpVals),
      listenOrders(setOrders),
      listenLots((data) => { setLots(data); setReady(true); }),
      listenSupplies(setSupplies),
      listenInventoryGarments(setInvGarments),
      listenPayments(setPayments),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, []);

  // Expose a helper that persists satOpVals to Firestore
  const updateSatOpVal = (satId, opId, val) => {
    dbSetSatOpVal(satId, opId, val);
  };

  return (
    <DataContext.Provider
      value={{
        users, clients, satellites, ops, satOpVals, updateSatOpVal,
        orders, lots, supplies, invGarments, payments, ready,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
