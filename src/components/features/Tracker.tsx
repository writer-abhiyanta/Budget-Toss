import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, query, onSnapshot, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { format } from 'date-fns';
import { Sparkles, Trash2, SmartphoneNfc, FileScan, Edit2, X, Camera } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

export const CATEGORIES = [
  'Food', 'Travel', 'Education', 'Film', 'Wearables', 
  'Book', 'Entertainment', 'Bike Good', 'Online Learning', 'Other', 'Domain'
];

export function Tracker() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [upiId, setUpiId] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [spendingPattern, setSpendingPattern] = useState('');
  
  // Receive State
  const [mode, setMode] = useState<'pay' | 'receive'>('pay');
  const [myUpiId, setMyUpiId] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveNote, setReceiveNote] = useState('Budget Toss Collection');

  const [checkoutQr, setCheckoutQr] = useState<{url: string, provider: string, amount: string} | null>(null);
  
  // Edit State
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [pendingPayment, setPendingPayment] = useState<{data: any, provider: string, url: string} | null>(null);

  // Scanner State
  const [showScanner, setShowScanner] = useState(false);

  // AI State
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/expenses`), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/expenses`));
    
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner('reader', { qrbox: { width: 250, height: 250 }, fps: 10 }, false);
      scanner.render(
        (decodedText) => {
          scanner.clear();
          setShowScanner(false);
          handleScanSuccess(decodedText);
        },
        (error) => {
          // Ignore general scan errors (happens when no code is visible)
        }
      );
      return () => {
        scanner.clear().catch(e => console.error("Scanner clear error", e));
      };
    }
  }, [showScanner]);

  const handleScanSuccess = (text: string) => {
    if (text.toLowerCase().startsWith('upi://pay')) {
      try {
        const urlParams = new URLSearchParams(text.split('?')[1]);
        const pa = urlParams.get('pa');
        const pn = urlParams.get('pn');
        const am = urlParams.get('am');
        
        if (pa) setUpiId(pa);
        if (pn) setDescription(pn);
        if (am) setAmount(am);
        
        // Switch to pay mode if not already
        setMode('pay');
      } catch (e) {
        console.error("Error parsing UPI string", e);
        setAiText(text);
      }
    } else {
      setAiText(text);
    }
  };

  const handleAddExpense = async (e?: React.FormEvent, paymentProvider?: 'gpay' | 'phonepe' | 'upi') => {
    if (e) e.preventDefault();
    if (!user || !amount || !description) return;
    
    // If a payment provider is selected and we are NOT editing, redirect to UPI and wait for confirmation
    const isEditing = !!editingExpenseId;
    if (!isEditing && paymentProvider) {
      if (!upiId) {
        alert("Please enter a Payee UPI ID (e.g., merchant@ybl) to initiate payment via " + (paymentProvider === 'gpay' ? 'Google Pay' : 'PhonePe') + ".");
        return;
      }
      
      const pa = encodeURIComponent(upiId);
      const tn = encodeURIComponent(description);
      const am = encodeURIComponent(amount);
      
      const standardUpiUrl = `upi://pay?pa=${pa}&pn=Merchant&am=${am}&cu=INR&tn=${tn}`;
      let url = standardUpiUrl;
      
      if (paymentProvider === 'gpay') {
        url = `gpay://upi/pay?pa=${pa}&pn=Merchant&am=${am}&cu=INR&tn=${tn}`;
      } else if (paymentProvider === 'phonepe') {
        url = `phonepe://pay?pa=${pa}&pn=Merchant&am=${am}&cu=INR&tn=${tn}`;
      }
      
      const data = {
        amount: parseFloat(amount),
        category,
        description,
        date: Date.now(),
        createdAt: Date.now(),
        paymentProvider,
        ...(sentiment && { sentiment }),
        ...(spendingPattern && { spendingPattern }),
      };
      
      setPendingPayment({ data, provider: paymentProvider, url });
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_top';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      return; // Stop here and wait for confirmation
    }

    const expenseId = isEditing ? editingExpenseId : crypto.randomUUID();
    const existingExpense = isEditing ? expenses.find(x => x.id === expenseId) : null;
    
    const data = {
      amount: parseFloat(amount),
      category,
      description,
      date: isEditing ? existingExpense.date : Date.now(),
      createdAt: isEditing ? existingExpense.createdAt : Date.now(),
      paymentProvider: paymentProvider || (isEditing ? existingExpense.paymentProvider : 'manual'),
      ...(sentiment && { sentiment }),
      ...(spendingPattern && { spendingPattern }),
    };
    
    try {
      await setDoc(doc(db, `users/${user.uid}/expenses/${expenseId}`), data, { merge: true });
      
      setAmount('');
      setDescription('');
      setUpiId('');
      setSentiment('');
      setSpendingPattern('');
      setEditingExpenseId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/expenses/${expenseId}`);
    }
  };

  const handleConfirmPayment = async (data: any) => {
    if (!user) return;
    try {
      const expenseId = crypto.randomUUID();
      await setDoc(doc(db, `users/${user.uid}/expenses/${expenseId}`), data, { merge: true });
      setPendingPayment(null);
      setAmount('');
      setDescription('');
      setUpiId('');
      setSentiment('');
      setSpendingPattern('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/expenses/${crypto.randomUUID()}`);
    }
  };

  const handleEdit = (expense: any) => {
    setEditingExpenseId(expense.id);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDescription(expense.description);
    setSentiment(expense.sentiment || '');
    setSpendingPattern(expense.spendingPattern || '');
    setMode('pay');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/expenses/${id}`));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/expenses/${id}`);
    }
  };

  const handleAIParseText = async () => {
    if (!aiText) return;
    setAiLoading(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is not configured");
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `Parse this text or receipt data and return ONLY a JSON object.
      The text is: "${aiText}"
      JSON schema: { "amount": number, "description": "string (short item name)", "category": "Pick exactly one from: ${CATEGORIES.join(', ')}", "upiId": "string (extract UPI ID if present like name@bank, or empty string)", "sentiment": "string (e.g. Positive, Neutral, Negative, Regretful, Necessary, Impulse)", "spendingPattern": "string (e.g. Subscription, Late night craving, Weekend fun, Utility, Unknown)" }`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      processAiResponse(response.text || '');
    } catch (err) {
      console.error("AI Parse error", err);
      alert("Failed to parse. Ensure API key is set.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiLoading(true);

    try {
      try {
        const html5QrCode = new Html5Qrcode("hidden-scanner-el");
        const decodedText = await html5QrCode.scanFile(file, true);
        if (decodedText) {
          handleScanSuccess(decodedText);
          return; // Stop here if we successfully decoded a QR
        }
      } catch (qrError) {
        // Not a readable QR code, fall back to AI receipt scan
        console.log("No QR code found in image, falling back to AI receipt parsing.");
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is not configured");
      const ai = new GoogleGenAI({ apiKey });

      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const prompt = `Analyze this receipt image. Return ONLY a JSON object.
      JSON schema: { "amount": number (total amount), "description": "string (merchant or short summary)", "category": "Pick exactly one from: ${CATEGORIES.join(', ')}", "upiId": "string (extract UPI ID if present, or empty string)", "sentiment": "string (e.g. Positive, Neutral, Negative, Regretful, Necessary, Impulse)", "spendingPattern": "string (e.g. Subscription, Late night craving, Weekend fun, Utility, Unknown)" }`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: file.type
            }
          }
        ]
      });

      processAiResponse(response.text || '');
    } catch (err) {
      console.error("AI Receipt Parse error", err);
      alert("Failed to read receipt. Please try another image.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAiLoading(false);
    }
  };

  const processAiResponse = (text: string) => {
    let raw = text;
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      const parsed = JSON.parse(raw);
      setAmount(parsed.amount?.toString() || '');
      setCategory(parsed.category || 'Other');
      setDescription(parsed.description || 'AI Parsed Transaction');
      setSentiment(parsed.sentiment || '');
      setSpendingPattern(parsed.spendingPattern || '');
      if (parsed.upiId) setUpiId(parsed.upiId);
      setAiText('');
    } catch(e) {
      console.log("Could not parse JSON", e);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      <div className="space-y-6">
        {/* Receipt Scanner / Text Parser */}
        <div className="anime-card bg-emerald-100 border-emerald-800">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="text-emerald-800 w-5 h-5" />
              <h3 className="text-xs font-bold uppercase text-emerald-800">AI Receipt / Text Scanner</h3>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowScanner(true)}
                className="bg-white px-2 py-1 rounded text-[10px] font-bold uppercase text-emerald-900 border-2 border-emerald-900 shadow-[2px_2px_0px_var(--color-anime-ink)] hover:translate-x-0.5 transition-transform flex items-center gap-1"
              >
                <Camera className="w-3 h-3" />
                Scan QR
              </button>
              <label className="cursor-pointer bg-white px-2 py-1 rounded text-[10px] font-bold uppercase text-emerald-900 border-2 border-emerald-900 shadow-[2px_2px_0px_var(--color-anime-ink)] hover:translate-x-0.5 transition-transform flex items-center gap-1">
                <FileScan className="w-3 h-3" />
                Image
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
          
          <div id="hidden-scanner-el" style={{ display: 'none' }}></div>

          {showScanner && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-4 w-full max-w-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-emerald-900 uppercase">Scan UPI/Merchant QR</h3>
                  <button onClick={() => setShowScanner(false)} className="text-gray-500 hover:text-red-500">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div id="reader" className="w-full !border-0 bg-gray-100 rounded-lg overflow-hidden"></div>
                <p className="text-[10px] uppercase font-bold text-gray-500 text-center mt-2">Point camera at QR code</p>
              </div>
            </div>
          )}

          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="Paste text/SMS or scan a receipt to auto-fill..."
            className="anime-input mb-4 h-20"
          />
          <button 
            onClick={handleAIParseText} 
            disabled={aiLoading || !aiText}
            className="anime-button w-full flex items-center justify-center gap-2"
          >
            {aiLoading ? 'Thinking...' : 'Extract Data'}
          </button>
        </div>

        {/* Payment / Receive Form */}
        <div className="anime-card space-y-4">
          <div className="flex gap-4 border-b-2 border-emerald-900 mb-4 pb-1 inline-flex">
            <button 
              className={`text-xs font-bold uppercase transition flex items-center gap-1 ${mode === 'pay' ? 'text-emerald-900' : 'text-emerald-500 hover:text-emerald-700'}`}
              onClick={() => setMode('pay')}
            >
              <SmartphoneNfc className="w-4 h-4" /> Pay inside Toss
            </button>
            <span className="text-emerald-300">|</span>
            <button 
              className={`text-xs font-bold uppercase transition flex items-center gap-1 ${mode === 'receive' ? 'text-emerald-900' : 'text-emerald-500 hover:text-emerald-700'}`}
              onClick={() => setMode('receive')}
            >
              <SmartphoneNfc className="w-4 h-4" /> Receive into Toss
            </button>
          </div>
          
          {mode === 'receive' ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Your UPI ID</label>
                  <input 
                    type="text" 
                    value={myUpiId} 
                    onChange={(e) => setMyUpiId(e.target.value)}
                    className="anime-input"
                    placeholder="name@okbank"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Amount (₹)</label>
                  <input 
                    type="number" 
                    value={receiveAmount} 
                    onChange={(e) => setReceiveAmount(e.target.value)}
                    className="anime-input"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Note / Description</label>
                <input 
                  type="text" 
                  value={receiveNote} 
                  onChange={(e) => setReceiveNote(e.target.value)}
                  className="anime-input"
                  placeholder="e.g. Split Dinner"
                />
              </div>

              {myUpiId && (
                <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-emerald-900 rounded shadow-[4px_4px_0px_var(--color-anime-ink)] mt-4 slide-in-from-bottom-4 animate-in fade-in">
                  <p className="text-xs font-bold uppercase text-emerald-800 mb-2">Scan to pay me</p>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${myUpiId}&pn=Budget%20Toss%20User&am=${receiveAmount}&cu=INR&tn=${receiveNote}`)}`} 
                    alt="Receive UPI QR Code"
                    className="w-40 h-40 border-4 border-emerald-100 rounded-lg shadow-sm"
                  />
                  {receiveAmount && <p className="text-xl font-black mt-2 text-emerald-900">₹{receiveAmount}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {checkoutQr && (
                <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-emerald-900 rounded shadow-[4px_4px_0px_var(--color-anime-ink)] mb-4 animate-in fade-in zoom-in">
                  <p className="text-xs font-bold uppercase text-emerald-800 mb-2">
                    Scan with {checkoutQr.provider === 'gpay' ? 'Google Pay' : 'PhonePe'} to Pay
                  </p>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkoutQr.url)}`} 
                    alt="Payment QR Code"
                    className="w-40 h-40 border-4 border-emerald-100 rounded-lg shadow-sm"
                  />
                  <p className="text-xl font-black mt-2 text-emerald-900">₹{checkoutQr.amount}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase text-center mt-1">Expense has been logged to your budget.</p>
                  <button 
                    onClick={() => setCheckoutQr(null)} 
                    className="mt-3 text-[10px] font-bold uppercase py-1 px-3 border border-emerald-300 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100"
                  >
                    Close
                  </button>
                </div>
              )}
              
              {pendingPayment && (
                <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-emerald-900 rounded shadow-[4px_4px_0px_var(--color-anime-ink)] mb-4 animate-in fade-in zoom-in">
                  <h3 className="text-lg font-black uppercase text-emerald-900 mb-2">Confirm Payment</h3>
                  <p className="text-[10px] uppercase font-bold text-gray-600 mb-4 text-center">
                    Did your payment of <strong className="text-emerald-800 text-sm">₹{pendingPayment.data.amount}</strong> via {pendingPayment.provider === 'gpay' ? 'Google Pay' : 'PhonePe'} succeed?
                  </p>
                  
                  {!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && (
                    <div className="mb-4 p-3 bg-emerald-50 rounded text-center w-full border border-emerald-200">
                      <p className="text-[10px] uppercase font-bold text-emerald-700 mb-2">Scan to Pay (Desktop)</p>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(pendingPayment.url)}`} className="w-32 h-32 mx-auto mix-blend-multiply border-2 border-white rounded shadow-sm" />
                    </div>
                  )}

                  <div className="flex gap-2 w-full mt-2">
                    <button 
                      type="button"
                      onClick={() => handleConfirmPayment(pendingPayment.data)}
                      className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded text-[10px] uppercase border-2 border-emerald-900 hover:bg-emerald-700"
                    >Yes, Add Expense</button>
                    <button 
                      type="button"
                      onClick={() => setPendingPayment(null)}
                      className="flex-1 bg-gray-200 text-gray-800 font-bold py-2 rounded text-[10px] uppercase border-2 border-gray-400 hover:bg-gray-300"
                    >No, Cancel</button>
                  </div>
                </div>
              )}
            <form onSubmit={(e) => handleAddExpense(e, undefined)} className="space-y-4">
              {editingExpenseId && (
                <div className="bg-yellow-50 p-2 rounded border border-yellow-200 text-yellow-800 text-xs font-bold flex justify-between items-center">
                  <span>Editing an existing expense</span>
                  <button type="button" onClick={() => {
                    setEditingExpenseId(null);
                    setAmount('');
                    setDescription('');
                    setSentiment('');
                    setSpendingPattern('');
                  }} className="text-yellow-900 border border-yellow-300 rounded px-2 hover:bg-yellow-200 transition">Cancel</button>
                </div>
              )}
              <div>
                <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Payee UPI ID (Optional)</label>
                <input 
                  type="text" 
                  value={upiId} 
                  onChange={(e) => setUpiId(e.target.value)}
                  className="anime-input"
                  placeholder="e.g. merchant@upi"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Amount (₹)</label>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)}
                    className="anime-input"
                    required 
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Domain</label>
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    className="anime-input bg-white"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">Description</label>
                <input 
                  type="text" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  className="anime-input"
                  required 
                  maxLength={100}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1 flex items-center gap-1">Sentiment <Sparkles className="w-3 h-3 text-emerald-500" /></label>
                  <input 
                    type="text" 
                    value={sentiment} 
                    onChange={(e) => setSentiment(e.target.value)}
                    className="anime-input"
                    placeholder="e.g. Necessary"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1 flex items-center gap-1">Pattern <Sparkles className="w-3 h-3 text-emerald-500" /></label>
                  <input 
                    type="text" 
                    value={spendingPattern} 
                    onChange={(e) => setSpendingPattern(e.target.value)}
                    className="anime-input"
                    placeholder="e.g. Subscription"
                    maxLength={50}
                  />
                </div>
              </div>
              
              <div className="pt-2 flex flex-col gap-2">
                {!editingExpenseId && (
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => handleAddExpense(undefined, 'phonepe')} 
                      className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-3 rounded text-sm transition text-center border-2 border-pink-900 shadow-[2px_2px_0px_rgba(28,25,23,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_rgba(28,25,23,1)]"
                    >
                      Pay via PhonePe
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleAddExpense(undefined, 'gpay')} 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded text-sm transition text-center border-2 border-green-900 shadow-[2px_2px_0px_rgba(28,25,23,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_rgba(28,25,23,1)]"
                    >
                      Pay via GPay
                    </button>
                  </div>
                )}
                <button type="submit" className="anime-button w-full">{editingExpenseId ? 'Update Expense' : 'Log Only (No Payment)'}</button>
              </div>
            </form>
            </div>
          )}
        </div>
      </div>

      <div className="anime-card flex flex-col">
        <h2 className="text-xs font-bold uppercase mb-4 text-emerald-900 border-b-2 border-emerald-900 inline-block self-start pb-1">Recent Spending Log</h2>
        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4">
          {expenses.map((expense) => (
            <div key={expense.id} className="border border-emerald-200 p-3 rounded-xl flex justify-between items-center group bg-white hover:bg-emerald-50 transition-colors">
              <div>
                <div className="font-bold text-emerald-900 flex items-center gap-2">
                  {expense.description}
                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">{expense.category}</span>
                  {expense.paymentProvider && expense.paymentProvider !== 'manual' && (
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                      expense.paymentProvider === 'phonepe' 
                        ? 'text-pink-700 bg-pink-100 border-pink-200' 
                        : expense.paymentProvider === 'gpay'
                        ? 'text-green-700 bg-green-100 border-green-200'
                        : 'text-emerald-700 bg-emerald-100 border-emerald-200'
                    }`}>
                      Via {expense.paymentProvider}
                    </span>
                  )}
                  {expense.sentiment && (
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 border ${
                      expense.sentiment.toLowerCase() === 'unknown' 
                        ? 'text-green-700 bg-green-100 border-green-200' 
                        : 'text-yellow-800 bg-yellow-100 border-yellow-200'
                    }`}>
                      {expense.sentiment}
                    </span>
                  )}
                  {expense.spendingPattern && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 border text-emerald-800 bg-emerald-100 border-emerald-200">
                      {expense.spendingPattern}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                  {format(new Date(expense.date), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-black text-lg text-emerald-800 mr-2">₹{expense.amount}</span>
                <button 
                  onClick={() => handleEdit(expense)}
                  className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 hover:text-emerald-700 bg-emerald-50 rounded p-1"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleDelete(expense.id)}
                  className="text-red-400 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 hover:text-red-700 bg-red-50 rounded p-1"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <div className="text-center p-8 bg-emerald-50 rounded-xl text-emerald-700 font-medium border border-emerald-100 border-dashed">
              No expenses recorded yet. Note it down!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
