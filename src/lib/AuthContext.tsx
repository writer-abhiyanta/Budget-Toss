import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  monthlyBudget: number;
  setMonthlyBudget: (budget: number) => Promise<void>;
  weeklyReportEnabled: boolean;
  setWeeklyReportEnabled: (enabled: boolean) => Promise<void>;
  lastReportSent: number | null;
  setLastReportSent: (timestamp: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  monthlyBudget: 0,
  setMonthlyBudget: async () => {},
  weeklyReportEnabled: false,
  setWeeklyReportEnabled: async () => {},
  lastReportSent: null,
  setLastReportSent: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlyBudget, setBudget] = useState(0);
  const [weeklyReportEnabled, setWeeklyReportEnabledState] = useState(false);
  const [lastReportSent, setLastReportSentState] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            const d = userDoc.data();
            setBudget(d.monthlyBudget || 0);
            setWeeklyReportEnabledState(!!d.weeklyReportEnabled);
            setLastReportSentState(d.lastReportSent || null);
          } else {
            // Create user document according to blueprint
            await setDoc(doc(db, 'users', u.uid), {
              monthlyBudget: 0,
              createdAt: Date.now(),
            });
            setBudget(0);
            setWeeklyReportEnabledState(false);
            setLastReportSentState(null);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const setMonthlyBudget = async (budget: number) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { monthlyBudget: budget }, { merge: true });
      setBudget(budget);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const setWeeklyReportEnabled = async (enabled: boolean) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { weeklyReportEnabled: enabled }, { merge: true });
      setWeeklyReportEnabledState(enabled);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const setLastReportSent = async (timestamp: number) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { lastReportSent: timestamp }, { merge: true });
      setLastReportSentState(timestamp);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, monthlyBudget, setMonthlyBudget, weeklyReportEnabled, setWeeklyReportEnabled, lastReportSent, setLastReportSent }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
