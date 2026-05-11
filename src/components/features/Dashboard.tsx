import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';

export function Dashboard() {
  const { user, monthlyBudget, setMonthlyBudget } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [editingBudget, setEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState(monthlyBudget.toString());
  const [activeTab, setActiveTab] = useState<'domains' | 'monthly' | 'quarterly'>('domains');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/expenses`), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/expenses`));
    
    return () => unsub();
  }, [user]);

  // Calculations
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalSpent = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const isOverBudget = monthlyBudget > 0 && totalSpent > monthlyBudget;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = new Date().getDate();
  const averageDailySpent = (totalSpent / currentDay).toFixed(2);
  const projectedMonthly = (parseFloat(averageDailySpent) * daysInMonth).toFixed(2);

  const categoryTotals = thisMonthExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));
  const COLORS = ['green', 'yellow', 'purple', 'orange', 'pink', 'maroon', 'beige', 'magenta'];

  // Data for Monthly Trends (Yearly overview)
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === i && d.getFullYear() === currentYear;
    });
    const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    return {
      name: new Date(currentYear, i).toLocaleString('default', { month: 'short' }),
      spending: total,
    };
  });

  // Data for Quarterly Trends
  const quarterlyData = Array.from({ length: 4 }, (_, i) => {
    const qExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return Math.floor(d.getMonth() / 3) === i && d.getFullYear() === currentYear;
    });
    const total = qExpenses.reduce((sum, e) => sum + e.amount, 0);
    return {
      name: `Q${i + 1}`,
      spending: total,
    };
  });

  const handleSaveBudget = () => {
    const val = parseFloat(tempBudget);
    if (!isNaN(val)) {
      setMonthlyBudget(val);
      setEditingBudget(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top Row: General Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 anime-card flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h1 className="text-xl font-black text-emerald-900 uppercase">Expenditure Report</h1>
            <div className="flex gap-2">
              {editingBudget ? (
                <div className="flex gap-2 items-center bg-white px-2 py-1 border border-emerald-200 rounded">
                  <input 
                    type="number" 
                    value={tempBudget} 
                    onChange={(e) => setTempBudget(e.target.value)}
                    className="w-16 outline-none text-xs font-bold text-center border-b border-emerald-500"
                  />
                  <button onClick={handleSaveBudget} className="text-[10px] font-bold text-emerald-600 uppercase hover:text-emerald-800">Save</button>
                </div>
              ) : (
                <button onClick={() => setEditingBudget(true)} className="px-2 py-1 bg-white border border-emerald-200 hover:bg-emerald-50 rounded text-[10px] font-bold text-emerald-700 transition-colors uppercase">
                  Budget: ₹{monthlyBudget}
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-center">
            <div className="p-2 transition-colors bg-white rounded-lg border border-emerald-100 flex flex-col items-center justify-center">
              <div className="text-[10px] uppercase text-emerald-600 font-bold mb-1">Spent</div>
              <div className={`text-xl font-black ${isOverBudget ? 'text-red-600' : 'text-emerald-900'}`}>₹{totalSpent}</div>
            </div>
            <div className="p-2 transition-colors bg-emerald-50 rounded-lg border border-emerald-100 flex flex-col items-center justify-center">
              <div className="text-[10px] uppercase text-emerald-600 font-bold mb-1">Avg Daily</div>
              <div className="text-xl font-black">₹{averageDailySpent}</div>
            </div>
            <div className="p-2 transition-colors bg-emerald-100 rounded-lg border border-emerald-200 flex flex-col items-center justify-center">
              <div className="text-[10px] uppercase text-emerald-600 font-bold mb-1">Proj. Monthly</div>
              <div className="text-xl font-black">₹{projectedMonthly}</div>
            </div>
            <div className="p-2 transition-colors bg-emerald-200 rounded-lg border border-emerald-300 flex flex-col items-center justify-center">
              <div className="text-[10px] uppercase text-emerald-700 font-bold mb-1">Safe Daily Limit</div>
              <div className="text-xl font-black">₹{monthlyBudget > 0 ? ((monthlyBudget - totalSpent) / (daysInMonth - currentDay || 1)).toFixed(2) : '0.00'}</div>
            </div>
          </div>
        </div>

        <div className="anime-card-gradient relative overflow-hidden flex flex-col justify-between hidden md:flex">
          <h3 className="text-xs font-bold uppercase text-emerald-900 mb-2">Budget Utilization</h3>
          <div className="flex-1 flex flex-col justify-end gap-3">
            <div className="text-xs">
              <div className="flex justify-between mb-1">
                <span className="font-bold text-emerald-900">Total Progress</span>
                <span className={`font-bold ${isOverBudget ? 'text-red-700' : 'text-emerald-800'}`}>
                  {monthlyBudget > 0 ? Math.round((totalSpent / monthlyBudget) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-white/50 h-3 rounded-full overflow-hidden border border-emerald-300/30">
                <div 
                  className={`h-full transition-all ${isOverBudget ? 'bg-red-500' : 'bg-emerald-600'}`} 
                  style={{ width: `${Math.min(monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0, 100)}%` }}
                ></div>
              </div>
            </div>
            {isOverBudget && (
              <div className="text-xs font-bold text-red-700 bg-red-100 p-2 rounded border border-red-200 flex items-center gap-1 mt-2">
                <span className="text-sm">⚠️</span> Budget Exceeded
              </div>
            )}
          </div>
        </div>
      </div>

      {isOverBudget && (
        <div className="anime-card !bg-red-50 !border-red-500 text-red-900 flex items-center gap-4 md:hidden">
          <div className="text-2xl animate-pulse">⚠️</div>
          <div>
            <h3 className="font-bold text-xl">Limit Crossed!</h3>
            <p className="text-sm">You have exceeded your monthly budget.</p>
          </div>
        </div>
      )}

      {/* Main charting grid */}
      <div className="flex-1 min-h-[350px] anime-card flex flex-col">
        <div className="flex flex-wrap items-center gap-4 mb-4 border-b-2 border-emerald-900 pb-2">
          <button 
            onClick={() => setActiveTab('domains')}
            className={`text-xs font-bold uppercase transition ${activeTab === 'domains' ? 'text-emerald-900 bg-emerald-200 px-3 py-1 rounded shadow-sm border border-emerald-900' : 'text-emerald-600 hover:text-emerald-800'}`}
          >
            Buying Domains
          </button>
          <button 
            onClick={() => setActiveTab('monthly')}
            className={`text-xs font-bold uppercase transition ${activeTab === 'monthly' ? 'text-emerald-900 bg-emerald-200 px-3 py-1 rounded shadow-sm border border-emerald-900' : 'text-emerald-600 hover:text-emerald-800'}`}
          >
            Yearly Trend
          </button>
          <button 
            onClick={() => setActiveTab('quarterly')}
            className={`text-xs font-bold uppercase transition ${activeTab === 'quarterly' ? 'text-emerald-900 bg-emerald-200 px-3 py-1 rounded shadow-sm border border-emerald-900' : 'text-emerald-600 hover:text-emerald-800'}`}
          >
            Quarterly Trend
          </button>
        </div>
      
        {activeTab === 'domains' && (
          pieData.length > 0 ? (
            <div className="flex-1 relative min-h-[250px] animate-in fade-in zoom-in-95 duration-300">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" stroke="var(--color-anime-ink)" strokeWidth={2}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid var(--color-anime-ink)', borderRadius: '0.5rem', fontWeight: 'bold' }} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8 bg-emerald-50 rounded-xl text-emerald-700 font-medium border border-emerald-100 border-dashed">
                No expenses logged yet for this month.
              </div>
            </div>
          )
        )}

        {activeTab === 'monthly' && (
          <div className="flex-1 relative min-h-[250px] animate-in fade-in slide-in-from-right-4 duration-300">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d1fae5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#064e3b', fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#064e3b', fontWeight: 'bold' }} />
                <RechartsTooltip cursor={{ fill: '#ecfdf5' }} contentStyle={{ backgroundColor: '#fff', border: '2px solid var(--color-anime-ink)', borderRadius: '0.5rem', fontWeight: 'bold' }} />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontWeight: 'bold', fontSize: '12px' }} />
                <Bar dataKey="spending" fill="orange" stroke="var(--color-anime-ink)" strokeWidth={2} name="Monthly Spending" radius={[4, 4, 0, 0]} />
                <ReferenceLine y={monthlyBudget} stroke="red" strokeDasharray="4 4" strokeWidth={2} label={{ position: 'top', value: 'Monthly Budget Limit', fill: 'red', fontSize: 10, fontWeight: 'bold' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'quarterly' && (
          <div className="flex-1 relative min-h-[250px] animate-in fade-in slide-in-from-right-4 duration-300">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quarterlyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d1fae5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#064e3b', fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#064e3b', fontWeight: 'bold' }} />
                <RechartsTooltip cursor={{ fill: '#ecfdf5' }} contentStyle={{ backgroundColor: '#fff', border: '2px solid var(--color-anime-ink)', borderRadius: '0.5rem', fontWeight: 'bold' }} />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontWeight: 'bold', fontSize: '12px' }} />
                <Bar dataKey="spending" fill="purple" stroke="var(--color-anime-ink)" strokeWidth={2} name="Quarterly Spending" radius={[4, 4, 0, 0]} />
                <ReferenceLine y={monthlyBudget * 3} stroke="red" strokeDasharray="4 4" strokeWidth={2} label={{ position: 'top', value: 'Quarterly Budget Limit', fill: 'red', fontSize: 10, fontWeight: 'bold' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
