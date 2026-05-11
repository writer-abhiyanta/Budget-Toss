import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, onSnapshot, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { CalendarClock, Trash2 } from 'lucide-react';

export function Planner() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [months, setMonths] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/buy_later`), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/buy_later`));
    
    return () => unsub();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || !totalAmount || !months) return;
    
    const itemId = crypto.randomUUID();
    const data = {
      title,
      totalAmount: parseFloat(totalAmount),
      months: parseInt(months, 10),
      createdAt: Date.now(),
    };
    
    try {
      await setDoc(doc(db, `users/${user.uid}/buy_later/${itemId}`), data);
      setTitle('');
      setTotalAmount('');
      setMonths('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/buy_later/${itemId}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/buy_later/${id}`));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/buy_later/${id}`);
    }
  };

  return (
    <div className="space-y-6 flex-1 h-full">
      <div className="anime-card !bg-emerald-50 !border-emerald-600 text-emerald-900 border-b-8">
        <div className="flex items-center gap-3 mb-2">
          <CalendarClock className="w-8 h-8 text-emerald-600" />
          <h2 className="text-2xl font-black uppercase tracking-wider font-sans">Buy Later & EMI Analyser</h2>
        </div>
        <p className="font-bold opacity-80 font-sans">
          Want something big? Analyse the EMI needed to buy it later instead of impulse buying now!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <form onSubmit={handleAdd} className="anime-card space-y-4 md:col-span-1 h-fit">
          <h3 className="text-xs font-bold uppercase mb-2 text-emerald-900 border-b-2 border-emerald-900 inline-block pb-1">Plan Purchase</h3>
          <div>
            <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Item Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              className="anime-input"
              placeholder="e.g. New Laptop"
              required 
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Total Amount (₹)</label>
            <input 
              type="number" 
              value={totalAmount} 
              onChange={(e) => setTotalAmount(e.target.value)}
              className="anime-input"
              required 
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Months to Save/EMI</label>
            <input 
              type="number" 
              value={months} 
              onChange={(e) => setMonths(e.target.value)}
              className="anime-input"
              min={1}
              required 
            />
          </div>
          <button type="submit" className="anime-button !bg-emerald-600 hover:!bg-emerald-700 !text-white w-full mt-2">Know Saving</button>
        </form>

        <div className="md:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="anime-card flex justify-between items-center group !bg-white">
              <div className="flex-1">
                <h4 className="font-bold text-lg text-emerald-900">{item.title}</h4>
                <div className="flex flex-wrap gap-4 mt-2 text-sm">
                  <div className="bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
                    <span className="text-emerald-700 font-bold block text-[10px] uppercase">Total</span>
                    <span className="font-black text-lg text-emerald-900">₹{item.totalAmount}</span>
                  </div>
                  <div className="bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
                    <span className="text-emerald-700 font-bold block text-[10px] uppercase">Duration</span>
                    <span className="font-black text-lg text-emerald-900">{item.months} months</span>
                  </div>
                  <div className="bg-emerald-100 px-3 py-1 rounded-md border border-emerald-400">
                    <span className="text-emerald-800 font-bold block text-[10px] uppercase">Monthly (EMI)</span>
                    <span className="font-black text-lg text-emerald-900">
                      ₹{Math.ceil(item.totalAmount / item.months)}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(item.id)}
                className="text-red-400 hover:text-red-600 ml-4 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 p-2"
              >
                <Trash2 />
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center p-8 bg-emerald-50 rounded-xl text-emerald-700 font-medium border border-emerald-100 border-dashed">
              No items planned. You are very content!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
