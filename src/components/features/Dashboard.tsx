import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { GoogleGenAI } from '@google/genai';
import { Sparkles, RefreshCw, Mail, CheckCircle2 } from 'lucide-react';

export function Dashboard() {
  const { user, monthlyBudget, setMonthlyBudget, weeklyReportEnabled, setWeeklyReportEnabled, lastReportSent, setLastReportSent } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<any[]>([]);
  const [editingBudget, setEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState(monthlyBudget.toString());
  const [activeTab, setActiveTab] = useState<'domains' | 'monthly' | 'quarterly'>('domains');
  
  // AI State
  const [aiFeedback, setAiFeedback] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/expenses`), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/expenses`));
    
    const q2 = query(collection(db, `users/${user.uid}/category_budgets`));
    const unsub2 = onSnapshot(q2, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCategoryBudgets(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/category_budgets`));
    
    return () => { unsub(); unsub2(); };
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

  // Auto trigger weekly email
  useEffect(() => {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (weeklyReportEnabled && expenses.length > 0 && user?.email && (!lastReportSent || (now - lastReportSent) > WEEK_MS)) {
      sendWeeklyEmailReport(true);
    }
  }, [weeklyReportEnabled, lastReportSent, expenses.length, user]);

  const categoryTotals = thisMonthExpenses.reduce((acc, curr) => {
    if (curr.amount > 0) {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    }
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

  const handleGetAIFeedback = async () => {
    setIsAiLoading(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is not configured");
      const ai = new GoogleGenAI({ apiKey });
      
      const compactExpenses = thisMonthExpenses.length > 0 
        ? thisMonthExpenses.map(e => `${e.amount} on ${e.category} (${e.description || ''})`).slice(0, 50).join(', ')
        : 'No expenses yet. They are either being frugal or forgot to log.';
      
      const prompt = `You are an anime-themed AI financial advisor with a slightly sassy but helpful personality. 
      Analyze these recent expenses and the overall budget.
      Total spent this month: ${totalSpent} (Budget limit: ${monthlyBudget || 'Not set'}).
      Projected spend: ${projectedMonthly}.
      Expenses: [${compactExpenses}]
      
      Provide a short, punchy 2-3 sentence comment on their spending habits or their budget setup. You can gently roast them if they are overspending or buying too many unnecessary things, praise them if they are doing well, or if they have no expenses, roast them for having a budget but not tracking or praise their ultimate frugality. Use markdown for styling if needed. Keep it very conversational.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      setAiFeedback(response.text || "I'm speechless... your financial data broke my circuits!");
    } catch (e) {
      console.error("AI Feedback error", e);
      setAiFeedback("Oops, my connection to the financial matrix was interrupted. Try again!");
    } finally {
      setIsAiLoading(false);
    }
  };

  const sendWeeklyEmailReport = async (isAuto = false) => {
    if (!user?.email || expenses.length === 0) return;
    
    if (!isAuto) setEmailSending(true);

    try {
      const recentExpenses = expenses.slice(0, 10);
      const expenseList = recentExpenses.map(e => `<li>₹${e.amount} - ${e.category} (${e.description || 'No description'})</li>`).join('');
      
      let domainAlertsHtml = '';
      if (categoryBudgets.length > 0) {
        domainAlertsHtml = '<h4>Domain Budget Alerts</h4><ul>';
        categoryBudgets.forEach(budget => {
          const spent = categoryTotals[budget.category] || 0;
          const isDomainOver = spent > budget.amount;
          domainAlertsHtml += `<li><strong>${budget.category}:</strong> Spent ₹${spent} / Limit ₹${budget.amount} ${isDomainOver ? '<span style="color:red;font-weight:bold;">(⚠️ EXCEEDED)</span>' : ''}</li>`;
        });
        domainAlertsHtml += '</ul><br/>';
      }

      const emailBody = `
        <h3>Weekly Budget & Expenditure Report</h3>
        <p><strong>Total Spent This Month:</strong> ₹${totalSpent}</p>
        <p><strong>Monthly Budget Target:</strong> ₹${monthlyBudget}</p>
        <p><strong>Average Daily Spent:</strong> ₹${averageDailySpent}</p>
        <p><strong>Projected Reach:</strong> ₹${projectedMonthly}</p>
        <br/>
        ${domainAlertsHtml}
        <h4>Recent Expenses (Top 10)</h4>
        <ul>${expenseList}</ul>
        ${isOverBudget ? '<br/><p style="color: red; font-weight: bold;">⚠️ You have currently exceeded your overall monthly budget.</p>' : ''}
      `;

      await fetch('/api/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          subject: 'Your Weekly Expend Report',
          message: emailBody
        })
      });
      
      await setLastReportSent(Date.now());
      if (!isAuto) alert('Weekly Report Email Sent!');
    } catch (e) {
      console.error(e);
      if (!isAuto) alert('Failed to send report. Please check server settings.');
    } finally {
      if (!isAuto) setEmailSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full pb-8">
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

      {/* Email Alerts Section */}
      <div className="anime-card !bg-white !border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase text-emerald-900">Weekly Budget Reports</h3>
            <p className="text-xs text-emerald-700 font-medium">Get a weekly summary of your expenses securely delivered to {user?.email || 'your email'}.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setWeeklyReportEnabled(!weeklyReportEnabled)}
            className={`flex-1 sm:flex-none text-xs font-bold uppercase py-2 px-3 rounded border-2 transition-all flex items-center justify-center gap-2 ${weeklyReportEnabled ? 'bg-emerald-100 border-emerald-500 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
          >
            {weeklyReportEnabled && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
            {weeklyReportEnabled ? 'Enabled' : 'Disabled'}
          </button>
          
          <button 
            onClick={() => sendWeeklyEmailReport(false)}
            disabled={emailSending}
            className="flex-1 sm:flex-none anime-button !py-2 !px-3 font-bold !text-xs whitespace-nowrap"
          >
            {emailSending ? 'Sending...' : 'Send Now'}
          </button>
        </div>
      </div>

      {/* AI Roast / Advice Section */}
      <div className="anime-card !bg-emerald-50 !border-emerald-500 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Sparkles className="w-24 h-24 text-emerald-900" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-black uppercase text-emerald-900 tracking-wider flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" /> 
              Roast Budget
            </h3>
            {aiFeedback ? (
              <p className="text-emerald-800 font-medium leading-relaxed italic border-l-4 border-emerald-400 pl-3 py-1 bg-white/50 rounded-r-lg">
                "{aiFeedback}"
              </p>
            ) : (
              <p className="text-emerald-700 text-sm font-bold opacity-80">
                Curious what a highly rational yet vaguely sassy AI thinks of your spending? 
              </p>
            )}
          </div>
          
          <button 
            onClick={handleGetAIFeedback}
            disabled={isAiLoading}
            className="anime-button shrink-0 flex items-center gap-2 shadow-sm"
          >
            {isAiLoading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> {aiFeedback ? 'Roast Me Again' : 'Analyze Patterns'}</>
            )}
          </button>
        </div>
      </div>

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
