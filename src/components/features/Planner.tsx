import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, onSnapshot, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { CalendarClock, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

export function Planner() {
  const { user, monthlyBudget } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [months, setMonths] = useState('');
  const [interestRate, setInterestRate] = useState('');
  
  // AI Evaluations State (local, intentionally not persisted to keep it fresh and snappy)
  const [evaluations, setEvaluations] = useState<Record<string, { loading: boolean; text?: string }>>({});

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
      ...(interestRate && { interestRate: parseFloat(interestRate) }),
      createdAt: Date.now(),
    };
    
    try {
      await setDoc(doc(db, `users/${user.uid}/buy_later/${itemId}`), data);
      setTitle('');
      setTotalAmount('');
      setMonths('');
      setInterestRate('');
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

  const handleEvaluate = async (item: any) => {
    setEvaluations(prev => ({ ...prev, [item.id]: { loading: true } }));
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is not configured");
      const ai = new GoogleGenAI({ apiKey });
      
      const emi = Math.ceil(item.totalAmount / item.months);
      
      const prompt = `You are an anime-themed, highly critical but caring financial advisor. 
      Your student wants to buy: "${item.title}" for ₹${item.totalAmount}.
      They plan to save/pay EMI over ${item.months} months, which is about ₹${emi}/month.
      Their stated total monthly budget limit is ₹${monthlyBudget || 'Unknown'}.
      
      Tell them honestly (in 2-3 short, engaging sentences) if this is a good idea or a terrible financial mistake. Be dramatic but helpful. Focus on the EMI vs Budget.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      setEvaluations(prev => ({ 
        ...prev, 
        [item.id]: { loading: false, text: response.text || "My financial scouter broke trying to analyze this." } 
      }));
    } catch (err) {
      console.error(err);
      setEvaluations(prev => ({ 
        ...prev, 
        [item.id]: { loading: false, text: "Sensei is unavailable right now." } 
      }));
    }
  };

  return (
    <div className="space-y-6 flex-1 h-full pb-8">
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
          <div>
            <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Interest Rate % (Optional)</label>
            <input 
              type="number" 
              value={interestRate} 
              onChange={(e) => setInterestRate(e.target.value)}
              className="anime-input"
              min={0}
              step="any"
              placeholder="0 (e.g., 10 for 10% pa)"
            />
          </div>
          <button type="submit" className="anime-button !bg-emerald-600 hover:!bg-emerald-700 !text-white w-full mt-2">Know Saving</button>
        </form>

        <div className="md:col-span-2 space-y-4">
          {items.map((item) => {
            const P = item.totalAmount;
            const n = item.months;
            const r = item.interestRate ? (item.interestRate / 12 / 100) : 0;
            let emiAmount = Math.ceil(P / n);
            if (r > 0) {
              emiAmount = Math.ceil(P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
            }
            
            const evaluation = evaluations[item.id];
            
            return (
            <div key={item.id} className="anime-card flex flex-col group !bg-white">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h4 className="font-bold text-lg text-emerald-900">
                      {item.title}
                      {item.interestRate && <span className="ml-2 text-[10px] uppercase font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded">@ {item.interestRate}% pa</span>}
                    </h4>
                  </div>
                  
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
                        ₹{emiAmount}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2 ml-4">
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 p-2 border border-transparent hover:bg-red-50 rounded"
                    title="Delete item"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  
                  <button 
                    onClick={() => handleEvaluate(item)}
                    disabled={evaluation?.loading}
                    className="anime-button !py-1 !px-2 flex flex-col items-center gap-1 opacity-80 hover:opacity-100"
                    title="Ask AI if this is a good idea"
                  >
                    {evaluation?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span className="text-[8px] leading-none uppercase">AI Evaluate</span>
                  </button>
                </div>
              </div>
              
              {evaluation?.text && (
                <div className="mt-4 p-3 bg-emerald-50 rounded-lg border-l-4 border-emerald-500 text-sm font-medium italic text-emerald-900">
                  <span className="font-bold flex items-center gap-1 mb-1 not-italic uppercase text-[10px] text-emerald-700">
                    <Sparkles className="w-3 h-3" /> AI Verdict:
                  </span>
                  "{evaluation.text}"
                </div>
              )}
            </div>
          )})}
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
