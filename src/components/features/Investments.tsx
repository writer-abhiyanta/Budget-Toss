import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, onSnapshot, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { TrendingUp, Trash2, IndianRupee } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

export function Investments() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [symbol, setSymbol] = useState('');
  const [assetType, setAssetType] = useState('stock');
  const [quantity, setQuantity] = useState('');
  const [averagePrice, setAveragePrice] = useState('');

  const ASSET_TYPES = [
    { value: 'stock', label: 'Stock' },
    { value: 'mutual_fund', label: 'Mutual Fund' },
    { value: 'crypto', label: 'Crypto' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/investments`), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/investments`));
    
    return () => unsub();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !symbol || !quantity || !averagePrice) return;
    
    const qty = parseFloat(quantity);
    const avg = parseFloat(averagePrice);
    
    if (isNaN(qty) || isNaN(avg)) return;

    const itemId = crypto.randomUUID();
    const data = {
      symbol: symbol.toUpperCase(),
      assetType,
      quantity: qty,
      averagePrice: avg,
      createdAt: Date.now(),
    };
    
    try {
      await setDoc(doc(db, `users/${user.uid}/investments/${itemId}`), data);
      setSymbol('');
      setQuantity('');
      setAveragePrice('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/investments/${itemId}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/investments/${id}`));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/investments/${id}`);
    }
  };

  const totalInvested = items.reduce((acc, item) => acc + (item.quantity * item.averagePrice), 0);

  // Group by asset type
  const typeTotals = items.reduce((acc, item) => {
    const val = item.quantity * item.averagePrice;
    acc[item.assetType] = (acc[item.assetType] || 0) + val;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(typeTotals).map(([name, value]) => ({ 
    name: ASSET_TYPES.find(t => t.value === name)?.label || name, 
    value 
  }));
  const COLORS = ['green', 'yellow', 'purple', 'orange', 'pink'];

  return (
    <div className="space-y-6 flex-1 h-full">
      <div className="anime-card !bg-emerald-50 !border-emerald-600 text-emerald-900 border-b-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-8 h-8 text-emerald-600" />
          <h2 className="text-2xl font-black uppercase tracking-wider font-sans">Investments</h2>
        </div>
        <p className="font-bold opacity-80 font-sans">
          Track your stocks, mutual funds, and other assets here.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="anime-card text-center bg-white">
            <h3 className="text-[10px] font-bold uppercase text-emerald-700 mb-2">Total Invested</h3>
            <div className="text-4xl font-black text-emerald-900 flex items-center justify-center gap-1">
              <IndianRupee className="w-6 h-6" />
              {totalInvested.toLocaleString()}
            </div>
          </div>

          <form onSubmit={handleAdd} className="anime-card space-y-4">
            <h3 className="text-xs font-bold uppercase mb-2 text-emerald-900 border-b-2 border-emerald-900 inline-block pb-1">Add Holding</h3>
            <div>
              <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Asset Symbol / Name</label>
              <input 
                type="text" 
                value={symbol} 
                onChange={(e) => setSymbol(e.target.value)}
                className="anime-input uppercase"
                placeholder="e.g. RELIANCE or VOO"
                required 
                maxLength={20}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Asset Type</label>
              <select 
                value={assetType} 
                onChange={(e) => setAssetType(e.target.value)}
                className="anime-input bg-white"
              >
                {ASSET_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Quantity</label>
                <input 
                  type="number" 
                  step="any"
                  value={quantity} 
                  onChange={(e) => setQuantity(e.target.value)}
                  className="anime-input"
                  placeholder="e.g. 10"
                  required 
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Avg Price (₹)</label>
                <input 
                  type="number" 
                  step="any"
                  value={averagePrice} 
                  onChange={(e) => setAveragePrice(e.target.value)}
                  className="anime-input"
                  placeholder="0"
                  required 
                />
              </div>
            </div>
            <button type="submit" className="anime-button !bg-emerald-600 hover:!bg-emerald-700 !text-white w-full mt-2">Log Investment</button>
          </form>
        </div>

        <div className="md:col-span-2 space-y-6">
          {pieData.length > 0 && (
            <div className="anime-card h-64 bg-white relative">
              <h3 className="text-xs font-bold uppercase mb-2 text-emerald-900 border-b-2 border-emerald-900 inline-block pb-1 absolute z-10">Asset Allocation</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="var(--color-anime-ink)" strokeWidth={2}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid var(--color-anime-ink)', borderRadius: '0.5rem', fontWeight: 'bold' }} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase mb-2 text-emerald-900 border-b-2 border-emerald-900 inline-block pb-1">Holdings</h3>
            {items.map((item) => (
              <div key={item.id} className="anime-card flex justify-between items-center group !bg-white">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-lg text-emerald-900">{item.symbol}</h4>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">
                      {ASSET_TYPES.find(t => t.value === item.assetType)?.label || item.assetType}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-emerald-700 mt-1">
                    {item.quantity} Qty @ ₹{item.averagePrice.toLocaleString()} Avg
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Value</p>
                    <p className="text-lg font-black text-emerald-900 flex items-center gap-1 justify-end">
                      ₹{(item.quantity * item.averagePrice).toLocaleString()}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 p-2"
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-center p-8 bg-emerald-50 rounded-xl text-emerald-700 font-medium border border-emerald-100 border-dashed">
                No active investments. Start growing your wealth today!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
