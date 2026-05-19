import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, onSnapshot, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { TrendingUp, Trash2, IndianRupee, RefreshCw, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

export function Investments() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [symbol, setSymbol] = useState('');
  const [assetType, setAssetType] = useState('stock');
  const [quantity, setQuantity] = useState('');
  const [averagePrice, setAveragePrice] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [dropPercentage, setDropPercentage] = useState('');

  const [marketData, setMarketData] = useState<Record<string, any>>({});
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);
  const [marketError, setMarketError] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  
  // Track which alerts we've already sent in this session to avoid spam
  const sentAlerts = useRef<Set<string>>(new Set());

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

  const fetchMarketData = async () => {
    const apiKey = import.meta.env.VITE_TWELVEDATA_API_KEY;
    if (!apiKey) {
      setMarketError('API key not configured in environment (VITE_TWELVEDATA_API_KEY). Showing stored values only.');
      return;
    }

    const uniqueSymbols = Array.from(new Set(items.map(i => i.symbol)));
    if (uniqueSymbols.length === 0) return;

    setIsLoadingMarket(true);
    setMarketError('');
    try {
      const res = await fetch(`https://api.twelvedata.com/quote?symbol=${uniqueSymbols.join(',')}&apikey=${apiKey}`);
      const data = await res.json();

      if (data.status === 'error') {
        throw new Error(data.message);
      }

      let formattedData: Record<string, any> = {};
      if (uniqueSymbols.length === 1) {
        if (data.symbol) {
          formattedData[data.symbol] = data;
        }
      } else {
        formattedData = data;
      }
      setMarketData(formattedData);
    } catch (err) {
      console.error('Market data fetch err', err);
      setMarketError('Failed to fetch real-time data or rate limit exceeded');
    } finally {
      setIsLoadingMarket(false);
    }
  };

  useEffect(() => {
    if (items.length > 0) {
      fetchMarketData();
    }
  }, [items.length]); // Only fetch when count changes to avoid spamming API on every render, manual refresh available

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !symbol || !quantity || !averagePrice) return;
    
    const qty = parseFloat(quantity);
    const avg = parseFloat(averagePrice);
    
    if (isNaN(qty) || isNaN(avg)) return;

    const itemId = crypto.randomUUID();
    const data: any = {
      symbol: symbol.toUpperCase(),
      assetType,
      quantity: qty,
      averagePrice: avg,
      createdAt: Date.now(),
    };

    if (targetPrice) data.targetPrice = parseFloat(targetPrice);
    if (dropPercentage) data.dropPercentage = parseFloat(dropPercentage);
    
    try {
      await setDoc(doc(db, `users/${user.uid}/investments/${itemId}`), data);
      setSymbol('');
      setQuantity('');
      setAveragePrice('');
      setTargetPrice('');
      setDropPercentage('');
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

  // Calculate totals including live market data if available
  let totalInvested = 0;
  let currentTotalValue = 0;
  
  items.forEach(item => {
    const invested = item.quantity * item.averagePrice;
    totalInvested += invested;
    
    const liveData = marketData[item.symbol];
    if (liveData && liveData.close) {
      currentTotalValue += (parseFloat(liveData.close) * item.quantity);
    } else {
      currentTotalValue += invested; // fallback to invested amount if no live data
    }
  });

  const totalReturn = currentTotalValue - totalInvested;
  const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  // Group by asset type based on CURRENT value
  const typeTotals = items.reduce((acc, item) => {
    const liveData = marketData[item.symbol];
    const livePrice = liveData && liveData.close ? parseFloat(liveData.close) : item.averagePrice;
    const val = item.quantity * livePrice;
    acc[item.assetType] = (acc[item.assetType] || 0) + val;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(typeTotals).map(([name, value]) => ({ 
    name: ASSET_TYPES.find(t => t.value === name)?.label || name, 
    value 
  }));
  const COLORS = ['green', 'yellow', 'purple', 'orange', 'pink'];

  // Generate alerts
  const alerts = useMemo(() => {
    const generatedAlerts: { id: string, message: string, type: 'up' | 'down' }[] = [];
    items.forEach(item => {
      const liveData = marketData[item.symbol];
      if (liveData && liveData.close) {
        const currentPrice = parseFloat(liveData.close);
        
        if (item.targetPrice && currentPrice >= item.targetPrice) {
          generatedAlerts.push({
            id: `${item.id}-target`,
            message: `${item.symbol} reached or exceeded your target price of ${item.targetPrice.toLocaleString()}! Current: ${currentPrice.toLocaleString()}`,
            type: 'up'
          });
        }

        if (item.dropPercentage && item.averagePrice) {
          const dropRatio = (item.averagePrice - currentPrice) / item.averagePrice;
          const dropPercent = dropRatio * 100;
          if (dropPercent >= item.dropPercentage) {
            generatedAlerts.push({
              id: `${item.id}-drop`,
              message: `${item.symbol} dropped by ${dropPercent.toFixed(2)}% (Limit: ${item.dropPercentage}%). Current: ${currentPrice.toLocaleString()}`,
              type: 'down'
            });
          }
        }
      }
    });
    return generatedAlerts;
  }, [items, marketData]);

  useEffect(() => {
    if (alerts.length > 0 && user?.email) {
      alerts.forEach(async (alert) => {
        if (!sentAlerts.current.has(alert.id)) {
          sentAlerts.current.add(alert.id);
          try {
            setEmailStatus(`Sending alert to ${user.email}...`);
            const res = await fetch('/api/send-alert', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                to: user.email,
                subject: `Market Alert: ${alert.message.substring(0, 30)}...`,
                message: alert.message
              })
            });
            if (res.ok) {
              setEmailStatus('Email alert sent successfully!');
              setTimeout(() => setEmailStatus(''), 5000);
            } else {
              setEmailStatus('Failed to send email alert (SMTP may not be configured).');
              setTimeout(() => setEmailStatus(''), 5000);
            }
          } catch (err) {
            setEmailStatus('Failed to send email alert.');
          }
        }
      });
    }
  }, [alerts, user]);

  return (
    <div className="space-y-6 flex-1 h-full">
      <div className="anime-card !bg-emerald-50 !border-emerald-600 text-emerald-900 border-b-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-8 h-8 text-emerald-600" />
          <h2 className="text-2xl font-black uppercase tracking-wider font-sans">Investments & Alerts</h2>
        </div>
        <p className="font-bold opacity-80 font-sans">
          Track your stocks, mutual funds, and get alerts on price changes.
        </p>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase text-emerald-900 border-b-2 border-emerald-900 inline-block pb-1">Market Alerts</h3>
          {alerts.map(alert => (
            <div key={alert.id} className={`anime-card p-3 flex items-center gap-3 ${alert.type === 'up' ? 'bg-green-100 border-green-500 text-green-900' : 'bg-red-100 border-red-500 text-red-900'}`}>
              <AlertCircle className={`w-5 h-5 ${alert.type === 'up' ? 'text-green-600' : 'text-red-600'}`} />
              <p className="text-sm font-bold">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {emailStatus && (
        <div className="bg-blue-50 border border-blue-300 text-blue-800 px-4 py-3 rounded flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{emailStatus}</p>
        </div>
      )}

      {marketError && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{marketError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 anime-card text-center bg-white flex flex-col justify-center gap-4 py-8">
          <div>
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-1">Total Invested</h3>
            <div className="text-xl font-bold text-gray-800 flex items-center justify-center gap-1">
              <IndianRupee className="w-4 h-4" />
              {totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-[10px] font-bold uppercase text-emerald-700 mb-2">Current Value</h3>
            <div className="text-4xl font-black text-emerald-900 flex items-center justify-center gap-1">
              {currentTotalValue > 0 && <IndianRupee className="w-6 h-6" />}
              {currentTotalValue > 0 ? currentTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </div>
            {totalInvested > 0 && (
              <div className={`text-xl font-black mt-3 flex items-center justify-center gap-3 ${totalReturn >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                <span>{totalReturn >= 0 ? '+' : ''}{totalReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className={`text-sm px-2 py-1 rounded-full font-bold border ${totalReturn >= 0 ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}>
                  {totalReturn >= 0 ? '+' : ''}{totalReturnPercent.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          {pieData.length > 0 ? (
            <div className="anime-card h-full min-h-[250px] bg-white relative flex flex-col items-center justify-center">
              <h3 className="text-xs font-bold uppercase mb-2 text-emerald-900 border-b-2 border-emerald-900 inline-block pb-1 absolute top-4 left-4 z-10">Asset Allocation</h3>
              <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={2} dataKey="value" stroke="var(--color-anime-ink)" strokeWidth={2}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} contentStyle={{ backgroundColor: '#fff', border: '2px solid var(--color-anime-ink)', borderRadius: '0.5rem', fontWeight: 'bold' }} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="anime-card h-full min-h-[250px] bg-emerald-50 border-emerald-100 flex items-center justify-center text-emerald-700 font-bold border-dashed text-sm">
                Add investments below to see your asset allocation here.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <form onSubmit={handleAdd} className="anime-card space-y-4">
            <h3 className="text-xs font-bold uppercase mb-2 text-emerald-900 border-b-2 border-emerald-900 inline-block pb-1">Add Holding</h3>
            <div>
              <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Asset Symbol / Name</label>
              <input 
                type="text" 
                value={symbol} 
                onChange={(e) => setSymbol(e.target.value)}
                className="anime-input uppercase"
                placeholder="e.g. AAPL or BTC/USD"
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
                <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Avg Price (₹ or $)</label>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Target Price (Alert)</label>
                <input 
                  type="number" 
                  step="any"
                  value={targetPrice} 
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="anime-input"
                  placeholder="e.g. 150"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Drop Alert (%)</label>
                <input 
                  type="number" 
                  step="any"
                  value={dropPercentage} 
                  onChange={(e) => setDropPercentage(e.target.value)}
                  className="anime-input"
                  placeholder="e.g. 5"
                />
              </div>
            </div>
            <button type="submit" className="anime-button !bg-emerald-600 hover:!bg-emerald-700 !text-white w-full mt-2">Log Investment</button>
          </form>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-end mb-2 border-b-2 border-emerald-900 pb-1">
              <h3 className="text-xs font-bold uppercase text-emerald-900">Holdings</h3>
              <button 
                onClick={fetchMarketData} 
                disabled={isLoadingMarket || items.length === 0}
                className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded hover:bg-emerald-200 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingMarket ? 'animate-spin' : ''}`} />
                {isLoadingMarket ? 'Refreshing...' : 'Refresh Quotes'}
              </button>
            </div>
            
            {items.map((item) => {
              const liveData = marketData[item.symbol];
              const currentPrice = liveData && liveData.close ? parseFloat(liveData.close) : item.averagePrice;
              const currentValue = item.quantity * currentPrice;
              const changePercent = liveData && liveData.percent_change ? parseFloat(liveData.percent_change) : 0;
              const isPositive = changePercent >= 0;
              
              return (
              <div key={item.id} className="anime-card flex justify-between gap-4 items-center group !bg-white">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-lg text-emerald-900 truncate max-w-[150px]" title={item.symbol}>{item.symbol}</h4>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded whitespace-nowrap">
                      {ASSET_TYPES.find(t => t.value === item.assetType)?.label || item.assetType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs font-bold text-gray-500">
                      {item.quantity} units @ {item.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Avg
                    </p>
                    {liveData && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-end shrink-0">
                  <p className="text-[10px] uppercase font-bold text-emerald-700 mb-0.5">Value</p>
                  <p className="text-lg font-black text-emerald-900 flex items-center justify-end">
                    {currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {liveData && liveData.close && (
                    <p className="text-[10px] font-bold text-gray-500 mt-0.5 truncate">
                      Last: {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <button 
                  onClick={() => handleDelete(item.id)}
                  className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 p-2 shrink-0 bg-red-50 rounded ml-2"
                  title="Delete Holding"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )})}
            
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
