'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, Activity, Terminal, Users, Server, Lock,
  ChevronRight, Search, Bell, FileText, AlertCircle, MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardView } from '@/components/dashboard-view';
import { ExecutionsView } from '@/components/executions-view';
import { AgentsView } from '@/components/agents-view';
import { GovernanceView } from '@/components/governance-view';
import { EnterpriseProofView } from '@/components/enterprise-proof-view';
import { AgentPlaygroundView } from '@/components/agent-playground-view';

type View = 'dashboard' | 'agents' | 'executions' | 'governance' | 'proof' | 'chat';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('chat');

  const navItems = [
    { id: 'chat', label: 'App Builder Agent', icon: MessageSquare },
    { id: 'dashboard', label: 'Mission Control', icon: Activity },
    { id: 'agents', label: 'Agents & Runtime', icon: Terminal },
    { id: 'executions', label: 'Evidence Boundary', icon: ShieldCheck },
    { id: 'governance', label: 'Governance Policies', icon: Lock },
    { id: 'proof', label: 'Enterprise Proof', icon: FileText },
  ];

  const renderView = () => {
    switch(currentView) {
      case 'dashboard': return <DashboardView />;
      case 'agents': return <AgentsView />;
      case 'chat': return <AgentPlaygroundView />;
      case 'executions': return <ExecutionsView />;
      case 'governance': return <GovernanceView />;
      case 'proof': return <EnterpriseProofView />;
      default: return <AgentPlaygroundView />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-300 font-sans">
      <div className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg tracking-wider">
            <Server className="w-5 h-5" />
            <span>DSG ONE</span>
          </div>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">
            WORKSPACE
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id as View)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150",
                    isActive 
                      ? "bg-indigo-500/10 text-indigo-400" 
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "text-indigo-400" : "text-slate-500")} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-slate-500">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
              <Users className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-slate-300 font-medium">Operator</span>
              <span className="text-xs">Org scope: configured by headers</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950/50 backdrop-blur-sm z-10 sticky top-0">
          <div className="flex items-center text-sm text-slate-500">
            <span>Control Plane</span>
            <ChevronRight className="w-4 h-4 mx-2 text-slate-700" />
            <span className="text-slate-300 capitalize">{currentView.replace('-', ' ')}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search is disabled until real evidence index exists..."
                disabled
                className="bg-slate-900 border border-slate-800 rounded-full pl-9 pr-4 py-1.5 text-sm text-slate-500 focus:outline-none w-72 placeholder:text-slate-600 transition-colors"
              />
            </div>
            <button className="relative p-2 text-slate-500" aria-label="Notifications unavailable until evidence events exist">
              <Bell className="w-4 h-4" />
            </button>
            <div className="h-8 border-l border-slate-800 mx-1"></div>
            <div className="px-3 py-1 bg-amber-500/10 text-amber-200 text-xs font-semibold rounded uppercase tracking-wide border border-amber-500/20 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Read-only planning layer
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 bg-[#0a0f1c]">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
