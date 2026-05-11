import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, onSnapshot, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ShieldBan, Trash2 } from 'lucide-react';

export function Limits() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/do_not_buy`), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/do_not_buy`));
    
    return () => unsub();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
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

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/do_not_buy/${id}`));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/do_not_buy/${id}`);
    }
  };

  return (
    <div className="space-y-6 flex-1 h-full">
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
        <form onSubmit={handleAdd} className="anime-card space-y-4 md:col-span-1 h-fit">
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
                onClick={() => handleDelete(item.id)}
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
    </div>
  );
}
