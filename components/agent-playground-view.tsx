'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, Loader2, PlayCircle, ShieldCheck, User } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

type Role = 'user' | 'model';

interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: string;
}

const AGENTS = [
  {
    id: 'ag_prod_8f9x2j',
    name: 'Compliance Checker',
    prompt: 'You are the Compliance Checker agent for DSG ONE. Your role is to evaluate inputs for PII leaks, rule violations, and enterprise compliance. Respond in a strict, professional tone.'
  },
  {
    id: 'ag_prod_4h1x9l',
    name: 'Customer Triage',
    prompt: 'You are the Customer Triage agent for DSG ONE. Your role is to classify customer requests, determine urgency, and suggest routing. Be helpful, concise, and structured in your replies.'
  },
  {
    id: 'ag_test_9p3m4z',
    name: 'Finance Audit Agent',
    prompt: 'You are the Finance Audit Agent for DSG ONE. Your role is to audit financial data, detect anomalies, and enforce ledger logic. Focus on numbers, risk analysis, and reconciliation.'
  }
];

function createAgentGreeting(agentId: string): ChatMessage {
  return {
    id: `${agentId}-${Date.now().toString()}-greeting`,
    role: 'model',
    text: `Connected to **${AGENTS.find(a => a.id === agentId)?.name}**.\\n\\nReady to receive execution input.`,
    timestamp: new Date().toLocaleTimeString()
  };
}

export function AgentPlaygroundView() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createAgentGreeting(AGENTS[0].id)]);
  const [input, setInput] = useState('');
  const [activeAgentId, setActiveAgentId] = useState(AGENTS[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const activeAgent = AGENTS.find(a => a.id === activeAgentId) || AGENTS[0];

  const handleAgentChange = (agentId: string) => {
    setActiveAgentId(agentId);
    setMessages([createAgentGreeting(agentId)]);
    setError(null);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessageStr = input.trim();
    setInput('');
    setError(null);
    setIsGenerating(true);

    const newUserMessage: ChatMessage = {
      id: Date.now().toString() + '-user',
      role: 'user',
      text: userMessageStr,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, newUserMessage]);

    try {
      if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
        throw new Error('Missing NEXT_PUBLIC_GEMINI_API_KEY. Please set this in the AI Studio Secrets panel.');
      }

      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      
      // Build history for context (excluding the first system greeting)
      const dialogHistory = messages.slice(1).map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));
      
      // Append new message
      dialogHistory.push({
        role: 'user',
        parts: [{ text: userMessageStr }]
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: dialogHistory as any,
        config: {
          systemInstruction: activeAgent.prompt
        }
      });

      const responseText = response.text || 'No response generated.';

      setMessages(prev => [...prev, {
        id: Date.now().toString() + '-model',
        role: 'model',
        text: responseText,
        timestamp: new Date().toLocaleTimeString()
      }]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during agent execution.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex justify-between items-start shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 items-center flex gap-2">
            Live Agent Chat & Verification
          </h1>
          <p className="text-slate-500 mt-1">Interact with your provisioned AI agents in a controlled execution wrapper.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 border border-slate-800 rounded-2xl bg-slate-900 flex flex-col overflow-hidden shadow-2xl">
        {/* Chat Header */}
        <div className="h-16 px-6 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200">{activeAgent.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                  Runtime Active
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                Target: {activeAgent.id} • API Key: Bound
              </div>
            </div>
          </div>
          <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-800">
            {AGENTS.map(agent => (
              <button
                key={agent.id}
                onClick={() => handleAgentChange(agent.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  activeAgentId === agent.id 
                    ? "bg-slate-800 text-slate-200 shadow-sm" 
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {agent.name}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={cn(
                "flex gap-4 max-w-[85%]",
                message.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className="shrink-0 pt-1">
                {message.role === 'model' ? (
                  <div className="w-8 h-8 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                )}
              </div>
              <div className={cn(
                "flex flex-col gap-1",
                message.role === 'user' ? "items-end" : "items-start"
              )}>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-slate-400">
                    {message.role === 'model' ? activeAgent.name : 'Operator'}
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono">
                    {message.timestamp}
                  </span>
                </div>
                <div className={cn(
                  "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                  message.role === 'user' 
                    ? "bg-indigo-600/20 border border-indigo-500/30 text-slate-200 rounded-tr-sm" 
                    : "bg-slate-800/50 border border-slate-700 text-slate-300 rounded-tl-sm markdown-body"
                )}>
                  {message.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{message.text}</div>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none markdown-body">
                      <ReactMarkdown>
                        {message.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="flex gap-4 max-w-[85%]">
              <div className="shrink-0 pt-1">
                <div className="w-8 h-8 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                </div>
              </div>
              <div className="flex flex-col gap-1 items-start">
                 <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-slate-400">{activeAgent.name}</span>
                </div>
                <div className="px-4 py-3 rounded-2xl bg-slate-800/50 border border-slate-700 rounded-tl-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span className="text-sm text-slate-400 font-mono">Executing trace & policy validation...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="mx-6 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm mb-4">
            <span className="font-semibold">Execution Failed:</span> {error}
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 shrink-0">
          <div className="max-w-4xl mx-auto relative group">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter execution payload, test case, or direct message..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-14 py-3.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none min-h-[60px] max-h-48"
              rows={1}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!input.trim() || isGenerating}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-colors"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-center mt-2.5">
            <p className="text-[10px] text-slate-600 flex items-center justify-center gap-1.5 font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Runtime decisions will trigger rule checks automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
