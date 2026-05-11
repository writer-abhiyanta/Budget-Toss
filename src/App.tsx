import React, { useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { logout } from './lib/firebase';
import LoginScreen from './components/LoginScreen';
import { Dashboard } from './components/features/Dashboard';
import { Tracker } from './components/features/Tracker';
import { Limits } from './components/features/Limits';
import { Planner } from './components/features/Planner';
import { Learn } from './components/features/Learn';
import { Investments } from './components/features/Investments';
import { LayoutDashboard, ReceiptText, ShieldBan, CalendarClock, GraduationCap, LogOut, TrendingUp } from 'lucide-react';
import { cn } from './lib/utils';

type Tab = 'dashboard' | 'tracker' | 'limits' | 'planner' | 'learn' | 'investments';

export default function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-bounce font-serif text-2xl font-bold tracking-widest text-anime-green-800">
          Loading Book...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tracker', label: 'Spend/Add Buy', icon: ReceiptText },
    { id: 'investments', label: 'Investments', icon: TrendingUp },
    { id: 'limits', label: 'Limit Buying', icon: ShieldBan },
    { id: 'planner', label: 'Resume Buyer', icon: CalendarClock },
    { id: 'learn', label: 'Learn', icon: GraduationCap },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[var(--color-anime-bg)] p-4 lg:p-6 gap-6">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 flex flex-col gap-4 flex-shrink-0">
        <div className="anime-card flex-grow overflow-y-auto custom-scrollbar flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="avatar" className="w-10 h-10 bg-emerald-500 rounded-full border-2 border-emerald-900 object-cover" />
            <div className="overflow-hidden">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 truncate">Google Management</h2>
              <p className="text-sm font-bold text-emerald-900 truncate">{user.displayName || user.email?.split('@')[0]}</p>
            </div>
          </div>
          
          <nav className="space-y-4">
            <div className="text-[10px] font-bold text-emerald-900 border-b border-emerald-200 pb-1 mb-2 uppercase">Menu</div>
            <div className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded text-sm transition-all text-left",
                    isActive 
                      ? "bg-emerald-100 font-bold text-emerald-900 border border-emerald-300" 
                      : "text-emerald-700 hover:bg-emerald-50 hover:translate-x-1 font-medium"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
            </div>
          </nav>
        </div>
        
        <button onClick={logout} className="anime-border bg-emerald-600 p-3 text-center cursor-pointer hover:bg-emerald-700 transition-colors rounded-xl border-2 border-anime-ink shadow-[4px_4px_0px_var(--color-anime-ink)] flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4 text-white" />
          <span className="text-white font-bold text-sm tracking-widest uppercase">Sign Out</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'tracker' && <Tracker />}
        {activeTab === 'investments' && <Investments />}
        {activeTab === 'limits' && <Limits />}
        {activeTab === 'planner' && <Planner />}
        {activeTab === 'learn' && <Learn />}
      </main>
    </div>
  );
}
