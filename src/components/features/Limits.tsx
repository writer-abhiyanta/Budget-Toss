import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, onSnapshot, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ShieldBan, Trash2, PieChart as PieChartIcon } from 'lucide-react';
import { CATEGORIES } from './Tracker';

export function Limits() {
  const { user } = useAuth();
  
  // Do Not Buy state
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');

  // Category Budgets state
  const [categoryBudgets, setCategoryBudgets] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [categoryAmount, setCategoryAmount] = useState('');
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    
    // Do Not Buy items
    const q1 = query(collection(db, `users/${user.uid}/do_not_buy`), orderBy('createdAt', 'desc'));
    const unsub1 = onSnapshot(q1, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/do_not_buy`));
    
    // Category Budgets
    const q2 = query(collection(db, `users/${user.uid}/category_budgets`), orderBy('createdAt', 'desc'));
    const unsub2 = onSnapshot(q2, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCategoryBudgets(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/category_budgets`));

    // Expenses for progress
    const q3 = query(collection(db, `users/${user.uid}/expenses`), orderBy('date', 'desc'));
    const unsub3 = onSnapshot(q3, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/expenses`));

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [user]);

  const handleAddDoNotBuy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || !reason) return;
    
    const itemId = crypto.randomUUID();
    const data = {
      title,
      reason,
      createdAt: Date.now(),
    };
    
    try {
      await setDoc(doc(db, `users/${user.uid}/do_not_buy/${itemId}`), data);
      setTitle('');
      setReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/do_not_buy/${itemId}`);
    }
  };

  const handleAddCategoryBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCategory || !categoryAmount) return;
    
    const budgetId = selectedCategory; // Use category as ID to allow overriding
    const data = {
      category: selectedCategory,
      amount: parseFloat(categoryAmount),
      createdAt: Date.now(),
    };
    
    try {
      await setDoc(doc(db, `users/${user.uid}/category_budgets/${budgetId}`), data);
      setCategoryAmount('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/category_budgets/${budgetId}`);
    }
  };

  const handleDeleteDoNotBuy = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/do_not_buy/${id}`));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/do_not_buy/${id}`);
    }
  };

  const handleDeleteCategoryBudget = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/category_budgets/${id}`));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/category_budgets/${id}`);
    }
  };

  // Calculations for progress
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const categorySpending = thisMonthExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 flex-1 h-full overflow-y-auto pb-8">
      {/* Do Not Buy Section */}
      <div className="anime-card !bg-emerald-50 !border-emerald-600 text-emerald-900 border-b-8">
        <div className="flex items-center gap-3 mb-2">
           <ShieldBan className="w-8 h-8 text-emerald-600" />
           <h2 className="text-2xl font-black uppercase tracking-wider font-sans">Do Not Buy</h2>
        </div>
        <p className="font-bold opacity-80 font-sans">
           Target to NOT spend money on these things. Protect your wallet!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <form onSubmit={handleAddDoNotBuy} className="anime-card space-y-4 md:col-span-1 h-fit">
          <h3 className="text-xs font-bold uppercase mb-2 text-emerald-900 border-b-2 border-emerald-900 inline-block pb-1">Add Temptation</h3>
          <div>
            <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Item to avoid</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              className="anime-input"
              placeholder="e.g. Mobile"
              required 
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Why bypass it?</label>
            <textarea 
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              className="anime-input h-24"
              placeholder="I already have 3 keyboards..."
              required 
              maxLength={200}
            />
          </div>
          <button type="submit" className="anime-button !bg-emerald-600 hover:!bg-emerald-700 !text-white w-full mt-2">Firmly Reject</button>
        </form>

        <div className="md:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="anime-card flex justify-between items-start group !bg-white">
              <div>
                <h4 className="font-bold text-lg line-through text-emerald-700 decoration-2">{item.title}</h4>
                <p className="text-emerald-800 mt-1 italic">"{item.reason}"</p>
              </div>
              <button 
                onClick={() => handleDeleteDoNotBuy(item.id)}
                className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 p-2"
              >
                <Trash2 />
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center p-8 bg-emerald-50 rounded-xl text-emerald-700 font-medium border border-emerald-100 border-dashed">
              No temptations resisted yet. You have a strong will!
            </div>
          )}
        </div>
      </div>

      {/* Domain Budgets Section */}
      <div className="anime-card !bg-emerald-50 !border-emerald-600 text-emerald-900 border-b-8 mt-12">
        <div className="flex items-center gap-3 mb-2">
          <PieChartIcon className="w-8 h-8 text-emerald-600" />
          <h2 className="text-2xl font-black uppercase tracking-wider font-sans">Domain Budgets</h2>
        </div>
        <p className="font-bold opacity-80 font-sans">
          Set maximum limits for specific domains.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <form onSubmit={handleAddCategoryBudget} className="anime-card space-y-4 md:col-span-1 h-fit">
          <h3 className="text-xs font-bold uppercase mb-2 text-emerald-900 border-b-2 border-emerald-900 inline-block pb-1">Set Limit</h3>
          
          <div>
            <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Domain</label>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="anime-input"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Monthly Max (₹)</label>
            <input 
              type="number" 
              value={categoryAmount} 
              onChange={(e) => setCategoryAmount(e.target.value)}
              className="anime-input"
              placeholder="e.g. 500"
              required 
              min={1}
            />
          </div>

          <button type="submit" className="anime-button !bg-emerald-600 hover:!bg-emerald-700 !text-white w-full mt-2">Set Budget</button>
        </form>

        <div className="md:col-span-2 space-y-4">
          {categoryBudgets.map((budget) => {
            const spent = categorySpending[budget.category] || 0;
            const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            const isOverBudget = spent > budget.amount;
            
            return (
              <div key={budget.id} className="anime-card group !bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-lg text-emerald-900 uppercase">{budget.category}</h4>
                    <p className="text-xs font-bold text-emerald-600 mt-1">₹{spent} spent / ₹{budget.amount} budget</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteCategoryBudget(budget.id)}
                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 p-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-emerald-100 h-3 rounded-full overflow-hidden border border-emerald-200 mt-2">
                  <div 
                    className={`h-full transition-all ${isOverBudget ? 'bg-red-500' : (percentage > 80 ? 'bg-yellow-500' : 'bg-emerald-500')}`} 
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  ></div>
                </div>
                
                {isOverBudget && (
                  <p className="text-[10px] font-bold text-red-600 uppercase mt-2">
                    ⚠️ Excess of ₹{(spent - budget.amount).toFixed(2)}
                  </p>
                )}
              </div>
            );
          })}
          
          {categoryBudgets.length === 0 && (
            <div className="text-center p-8 bg-emerald-50 rounded-xl text-emerald-700 font-medium border border-emerald-100 border-dashed">
              No domain budgets set.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
