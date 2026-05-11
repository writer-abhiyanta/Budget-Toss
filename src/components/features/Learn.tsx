import React, { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { GoogleGenAI } from '@google/genai';
import { GraduationCap, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';

export function Learn() {
  const { user, monthlyBudget } = useAuth();
  const [topic, setTopic] = useState('sip');
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');

  const topics = [
    { id: 'sip', name: 'SIP (Systematic Investment Plan)' },
    { id: 'trades', name: 'Stock Trading Basics' },
    { id: 'loan', name: 'Managing Loans & EMI' },
    { id: 'frugal', name: 'Frugal Living & Saving' },
    { id: 'advice', name: 'Personalized Advice on My Budget' },
  ];

  const handleLearn = async () => {
    setLoading(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is not configured");
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `You are a financial advisor from an anime world (use a slightly energetic, encouraging tone like a shounen mentor). 
      The user wants to learn about: ${topic}. 
      ${topic === 'advice' ? `The user's monthly budget is ₹${monthlyBudget}. Give advice on how not to spend money unnecessarily.` : ''}
      Provide a highly educational, structured, markdown formatted response explaining this topic. Keep it engaging, clear, and actionable. Do not use any emojis or unnecessary symbols in your response.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      setContent(response.text || 'Sensei is silent...');
      
    } catch (err) {
      console.error("AI Parse error", err);
      setContent('Failed to load lesson. Ensure API key is set.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 flex-1 h-full">
      <div className="anime-card !bg-emerald-50 !border-emerald-600 text-emerald-900 border-b-8">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="w-8 h-8 text-emerald-600" />
          <h2 className="text-2xl font-black uppercase tracking-wider font-sans">Financial Dojo</h2>
        </div>
        <p className="font-bold opacity-80 font-sans">
          Learn about buying methods, SIPs, trades, loans, and get advice on your spending money!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="anime-card space-y-4 md:col-span-1 h-fit">
          <h3 className="text-xs font-bold uppercase mb-2 text-emerald-900 border-b-2 border-emerald-900 inline-block pb-1">Choose Topic</h3>
          <div className="space-y-2">
            {topics.map(t => (
              <button
                key={t.id}
                onClick={() => setTopic(t.id)}
                className={`block w-full text-left px-3 py-2 border rounded-md transition-all text-sm ${
                  topic === t.id ? 'bg-emerald-100 font-bold border-emerald-400 text-emerald-900 shadow-[2px_2px_0px_var(--color-anime-ink)] translate-x-1' : 'bg-white border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-medium'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
          <button 
            onClick={handleLearn} 
            disabled={loading}
            className="anime-button !bg-emerald-600 hover:!bg-emerald-700 !text-white w-full flex items-center justify-center gap-2 mt-4"
          >
            {loading ? 'Consulting Sensei...' : <><Sparkles className="w-4 h-4" /> Learn Now</>}
          </button>
        </div>

        <div className="md:col-span-3">
          {content ? (
            <div className="anime-card">
              <div className="markdown-body">
                <Markdown>{content}</Markdown>
              </div>
            </div>
          ) : (
            <div className="anime-card text-center p-12 bg-emerald-50 rounded-xl text-emerald-700 font-medium border border-emerald-100 border-dashed flex flex-col items-center justify-center min-h-[300px]">
              <GraduationCap className="w-16 h-16 text-emerald-300 mb-4" />
              Select a topic and click "Learn Now" to start your training!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
