import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  monthlyBudget: number;
  setMonthlyBudget: (budget: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  monthlyBudget: 0,
  setMonthlyBudget: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlyBudget, setBudget] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            setBudget(userDoc.data().monthlyBudget || 0);
          } else {
            // Create user document according to blueprint
            await setDoc(doc(db, 'users', u.uid), {
              monthlyBudget: 0,
              createdAt: Date.now(),
            });
            setBudget(0);
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

  return (
    <AuthContext.Provider value={{ user, loading, monthlyBudget, setMonthlyBudget }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
