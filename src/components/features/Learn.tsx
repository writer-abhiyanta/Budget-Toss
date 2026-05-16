import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { GoogleGenAI } from '@google/genai';
import { GraduationCap, Sparkles, MessageCircle, Route, HelpCircle, Send, CheckCircle2, XCircle } from 'lucide-react';
import Markdown from 'react-markdown';

type LearnMode = 'path' | 'qa' | 'quiz';

export function Learn() {
  const { user, monthlyBudget } = useAuth();
  const [mode, setMode] = useState<LearnMode>('path');
  const [loading, setLoading] = useState(false);

  // Path State
  const [financialGoal, setFinancialGoal] = useState('');
  const [pathContent, setPathContent] = useState('');

  // Q&A State
  const [qaInput, setQaInput] = useState('');
  const [qaHistory, setQaHistory] = useState<{role: 'user'|'model', text: string}[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Quiz State
  const [quizTopic, setQuizTopic] = useState('Investing Basics');
  const [quizData, setQuizData] = useState<{question: string, options: string[], answerIndex: number, explanation: string} | null>(null);
  const [quizSelected, setQuizSelected] = useState<number | null>(null);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [qaHistory]);

  const initAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key is not configured");
    return new GoogleGenAI({ apiKey });
  };

  const handleGeneratePath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!financialGoal) return;
    setLoading(true);
    try {
      const ai = initAI();
      const prompt = `You are a financial advisor from an anime world (use a slightly energetic, encouraging tone like a shounen mentor). 
      The user's financial goal is: ${financialGoal}. 
      ${monthlyBudget ? `The user's monthly budget is ₹${monthlyBudget}.` : ''}
      Create a step-by-step personalized learning path to help them achieve this goal. 
      Provide a highly educational, structured, markdown formatted response explaining the path. 
      Keep it engaging, clear, and actionable. Do not use any emojis.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      setPathContent(response.text || 'Sensei is silent...');
    } catch (err) {
      console.error("AI Parse error", err);
      setPathContent('Failed to generate path. Ensure API key is set.');
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim()) return;
    
    const newHistory = [...qaHistory, { role: 'user' as const, text: qaInput }];
    setQaHistory(newHistory);
    setQaInput('');
    setLoading(true);
    
    try {
      const ai = initAI();
      
      const systemPrompt = `You are an energetic, encouraging financial mentor from an anime world. Answer the user's questions clearly and provide actionable financial advice. No emojis.`;
      
      // We will just send the whole history as text for simplicity, as chat support varies in SDKs
      const conversationText = newHistory.map(m => `${m.role === 'user' ? 'Student' : 'Sensei'}: ${m.text}`).join('\n');
      
      const prompt = `${systemPrompt}\n\nConversation so far:\n${conversationText}\n\nSensei:`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      setQaHistory([...newHistory, { role: 'model', text: response.text || 'I need to meditate on this...' }]);
    } catch (err) {
      console.error("Chat error", err);
      setQaHistory([...newHistory, { role: 'model', text: 'Error connecting to Sensei. Check your connection or API key.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTopic) return;
    
    setLoading(true);
    setQuizSelected(null);
    setQuizData(null);
    
    try {
      const ai = initAI();
      const prompt = `You are an anime financial mentor testing your student. Generate a multiple choice question about: ${quizTopic}.
      Respond ONLY in valid JSON format.
      Schema: {
        "question": "The question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answerIndex": 0, // The integer index of the correct option (0-3)
        "explanation": "A brief anime-style encouraging explanation of why this is the correct answer."
      }`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      let raw = response.text || '';
      raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(raw);
      setQuizData(parsed);
    } catch (err) {
      console.error("Quiz error", err);
      alert('Failed to generate quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col h-full h-full overflow-hidden">
      <div className="anime-card !bg-emerald-50 !border-emerald-600 text-emerald-900 border-b-8 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="w-8 h-8 text-emerald-600" />
          <h2 className="text-2xl font-black uppercase tracking-wider font-sans">Financial Dojo</h2>
        </div>
        <p className="font-bold opacity-80 font-sans">
          Your path to financial mastery! Choose your training mode below.
        </p>

        <div className="flex flex-wrap gap-4 mt-6">
          <button 
            onClick={() => setMode('path')}
            className={`px-4 py-2 font-bold uppercase text-xs rounded border-2 transition ${mode === 'path' ? 'bg-emerald-600 text-white border-emerald-800 shadow-[2px_2px_0px_var(--color-anime-ink)] translate-y-px translate-x-px' : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-100'}`}
          >
            <span className="flex items-center gap-2"><Route className="w-4 h-4"/> Learning Paths</span>
          </button>
          <button 
            onClick={() => setMode('qa')}
            className={`px-4 py-2 font-bold uppercase text-xs rounded border-2 transition ${mode === 'qa' ? 'bg-emerald-600 text-white border-emerald-800 shadow-[2px_2px_0px_var(--color-anime-ink)] translate-y-px translate-x-px' : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-100'}`}
          >
            <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4"/> Q&A Session</span>
          </button>
          <button 
            onClick={() => setMode('quiz')}
            className={`px-4 py-2 font-bold uppercase text-xs rounded border-2 transition ${mode === 'quiz' ? 'bg-emerald-600 text-white border-emerald-800 shadow-[2px_2px_0px_var(--color-anime-ink)] translate-y-px translate-x-px' : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-100'}`}
          >
            <span className="flex items-center gap-2"><HelpCircle className="w-4 h-4"/> Quiz Mastery</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 pb-4">
        {mode === 'path' && (
          <div className="space-y-6">
            <form onSubmit={handleGeneratePath} className="anime-card bg-white">
              <h3 className="text-xs font-bold uppercase mb-2 text-emerald-900 border-b-2 border-emerald-900 inline-block pb-1">Define Your Goal</h3>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={financialGoal}
                  onChange={(e) => setFinancialGoal(e.target.value)}
                  placeholder="e.g. Save 1 Lakh for an emergency fund, Buy a car in 3 years..."
                  className="anime-input flex-1"
                  required
                />
                <button type="submit" disabled={loading} className="anime-button !bg-emerald-600 hover:!bg-emerald-700 !text-white whitespace-nowrap">
                  {loading ? 'Mapping Path...' : 'Map Path'}
                </button>
              </div>
            </form>

            {pathContent && (
              <div className="anime-card markdown-body animate-in fade-in slide-in-from-bottom-4">
                <Markdown>{pathContent}</Markdown>
              </div>
            )}
            
            {!pathContent && !loading && (
              <div className="anime-card text-center p-12 bg-emerald-50 rounded-xl text-emerald-700 font-medium border border-emerald-100 border-dashed">
                <Route className="w-16 h-16 text-emerald-300 mb-4 mx-auto" />
                Tell Sensei your goal, and receive a personalized training regimen.
              </div>
            )}
          </div>
        )}

        {mode === 'qa' && (
          <div className="anime-card h-full flex flex-col p-0 overflow-hidden bg-emerald-50 border-emerald-300 min-h-[400px]">
            <div className="bg-emerald-600 text-white p-3 font-bold uppercase text-xs flex items-center justify-between shadow-md z-10">
              <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Ask Sensei</span>
              <span>Available</span>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {qaHistory.length === 0 && (
                <div className="text-center text-emerald-700 font-bold opacity-50 mt-10">
                  Ready to assist with your financial questions!
                </div>
              )}
              {qaHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl p-3 border-2 shadow-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white border-emerald-800' : 'bg-white text-emerald-900 border-emerald-300'}`}>
                    <p className="text-xs font-black uppercase opacity-70 mb-1 border-b border-current pb-1 inline-block">
                      {msg.role === 'user' ? 'You' : 'Sensei'}
                    </p>
                    <div className={`markdown-body text-sm ${msg.role === 'user' ? '!text-white' : ''}`}>
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-xl p-3 border-2 shadow-sm bg-white text-emerald-900 border-emerald-300 italic text-sm">
                    Sensei is contemplating...
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleAskQuestion} className="p-3 bg-white border-t-2 border-emerald-300 flex gap-2 z-10">
              <input 
                type="text"
                value={qaInput}
                onChange={e => setQaInput(e.target.value)}
                placeholder="Ask about SIP, budgets, etc..."
                className="flex-1 px-3 py-2 border-2 border-emerald-300 rounded font-medium focus:border-emerald-600 focus:outline-none"
                disabled={loading}
              />
              <button disabled={loading || !qaInput.trim()} type="submit" className="p-3 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 disabled:opacity-50 transition border-2 border-emerald-900 shadow-[2px_2px_0px_var(--color-anime-ink)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_var(--color-anime-ink)]">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {mode === 'quiz' && (
          <div className="space-y-6">
             <form onSubmit={handleGenerateQuiz} className="anime-card bg-white">
              <h3 className="text-xs font-bold uppercase mb-2 text-emerald-900 border-b-2 border-emerald-900 inline-block pb-1">Select Topic to Practice</h3>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={quizTopic}
                  onChange={(e) => setQuizTopic(e.target.value)}
                  placeholder="e.g. Mutual Funds, Credit Score..."
                  className="anime-input flex-1"
                  required
                />
                <button type="submit" disabled={loading} className="anime-button !bg-emerald-600 hover:!bg-emerald-700 !text-white whitespace-nowrap">
                  {loading ? 'Crafting question...' : 'Train Me'}
                </button>
              </div>
            </form>

            {quizData && (
              <div className="anime-card animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-xl font-black text-emerald-900 mb-6">{quizData.question}</h3>
                
                <div className="space-y-3">
                  {quizData.options.map((opt, i) => (
                    <button
                      key={i}
                      disabled={quizSelected !== null}
                      onClick={() => setQuizSelected(i)}
                      className={`w-full text-left p-4 rounded-lg border-2 font-bold transition flex items-center justify-between ${
                        quizSelected === null 
                          ? 'bg-white border-emerald-300 hover:bg-emerald-50 hover:border-emerald-500 text-emerald-800' 
                          : i === quizData.answerIndex 
                          ? 'bg-green-100 border-green-500 text-green-900' 
                          : quizSelected === i 
                          ? 'bg-red-100 border-red-500 text-red-900'
                          : 'bg-white border-emerald-100 text-emerald-300 opacity-50'
                      }`}
                    >
                      <span>{opt}</span>
                      {quizSelected !== null && i === quizData.answerIndex && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                      {quizSelected === i && i !== quizData.answerIndex && <XCircle className="w-5 h-5 text-red-600" />}
                    </button>
                  ))}
                </div>

                {quizSelected !== null && (
                  <div className={`mt-6 p-4 rounded-xl border-2 ${quizSelected === quizData.answerIndex ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                    <p className="font-bold text-sm uppercase mb-2">
                       {quizSelected === quizData.answerIndex ? 'Excellent form!' : 'Keep training!'}
                    </p>
                    <p className="font-medium text-gray-700">{quizData.explanation}</p>
                    
                    <button onClick={handleGenerateQuiz} className="mt-4 anime-button bg-emerald-600 hover:bg-emerald-700 text-white w-full">
                      Next Question
                    </button>
                  </div>
                )}
              </div>
            )}

            {!quizData && !loading && (
              <div className="anime-card text-center p-12 bg-emerald-50 rounded-xl text-emerald-700 font-medium border border-emerald-100 border-dashed">
                <HelpCircle className="w-16 h-16 text-emerald-300 mb-4 mx-auto" />
                Select a topic to test your financial knowledge!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
