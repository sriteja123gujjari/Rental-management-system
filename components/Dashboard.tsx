import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Receipt, Wallet, Users, Download, Plus, Trash2,
  ChevronLeft, ChevronRight, TrendingUp, CreditCard,
  Loader2, ArrowRightLeft, UserCircle, Save, AlertCircle, Pencil, X, LogOut, Share2, List, CheckCircle2, Check,
  Smartphone, AlertTriangle, QrCode
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { api } from '../services/api';
import { generatePDF } from '../services/pdf';
// DEFAULT_SHOPS_DATA removed — each user's shops come from their own DB data only

// --- TYPES ---
interface Shop { id: string; name: string; base_rent: number; }
interface RentRecord { shop_id: string; amount_paid: number; collected_by: string; status: string; is_settled?: boolean; }
interface Expense { id: string; description: string; amount: number; paid_by: string; is_settled?: boolean; }

interface DashboardProps {
  user: any;
  onLogout: () => void;
  userMembers: string[];         // Dynamic — from user_preferences
  predefinedExpenses: string[];  // Dynamic — from user_preferences
  familyId: string;              // From App.tsx state — never fallback to hardcoded value
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, style: 'decimal' }).format(amount);
};

const Dashboard = ({ user, onLogout, userMembers, predefinedExpenses, familyId }: DashboardProps) => {

  // Dynamic constants from props (replaces hardcoded values)
  const MEMBERS = userMembers;
  const PREDEFINED_EXPENSES = predefinedExpenses;

  // DATA STATES
  const [shops, setShops] = useState<Shop[]>([]);
  const [records, setRecords] = useState<RentRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [arrears, setArrears] = useState<Record<string, number>>({});
  const [hasAnyShops, setHasAnyShops] = useState(false);
  // UPI IDs: map of memberName → upiId
  const [memberUpiIds, setMemberUpiIds] = useState<Record<string, string>>({});
  // UPI edit state: tracks which member's UPI ID is being edited (null = none)
  const [editingUpiMember, setEditingUpiMember] = useState<string | null>(null);
  const [upiEditValue, setUpiEditValue] = useState('');
  const [savingUpi, setSavingUpi] = useState(false);
  // QR code expansion: track which transaction index has QR expanded
  const [expandedQr, setExpandedQr] = useState<number | null>(null);

  // Toast state for QR Code download status
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Auto-clear toast timer
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleDownloadAndPay = (canvasId: string, amount: number, to: string, customUpiAppScheme?: string) => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (canvas) {
      try {
        const url = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        const cleanName = to.replace(/[^a-zA-Z0-9]/g, '_');
        a.download = `Pay_${cleanName}_Rs_${amount}_QR.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Show success toast
        setToast({
          message: `QR code saved! Open your payment app, tap Scan QR, and choose the image from your gallery/photos.`,
          type: 'success'
        });
      } catch (err) {
        console.error("Failed to download QR code image", err);
        setToast({
          message: "Failed to download QR code automatically. Please try taking a screenshot instead.",
          type: 'info'
        });
      }
    }

    // Direct synchronous redirection to prevent mobile browsers from blocking custom URI schemes as popups
    if (customUpiAppScheme) {
      window.location.href = customUpiAppScheme;
    } else {
      window.location.href = "upi://";
    }
  };

  // UI STATES
  const [newShopName, setNewShopName] = useState('');
  const [newShopRent, setNewShopRent] = useState('');
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpensePayer, setNewExpensePayer] = useState(MEMBERS[0]);
  const [isCustomExpense, setIsCustomExpense] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCollector, setPaymentCollector] = useState(MEMBERS[0]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // --- DATA FETCHING ---
  const refreshData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const hasShops = await api.checkExistingFamilyData(familyId);
      setHasAnyShops(hasShops);

      const data = await api.fetchMonthData(currentMonth, familyId);
      setShops(data.shops || []);
      setRecords(data.rentRecords || []);
      setExpenses(data.expenses || []);
      const arrearsData = await api.fetchArrears(currentMonth, familyId);
      setArrears(arrearsData);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  // Load UPI IDs once on mount (or when familyId changes)
  useEffect(() => {
    api.getMemberUpiIds(familyId).then(setMemberUpiIds).catch(() => { });
  }, [familyId]);

  useEffect(() => {
    refreshData(false);
  }, [currentMonth, familyId]);

  // --- CALCULATIONS ---
  const monthlyData = useMemo(() => {

    // --- PART 1: TOTAL STATS ---
    const totalReceived = records
      .filter((r) => r.status === 'Paid')
      .reduce((sum, r) => sum + Number(r.amount_paid || 0), 0);

    const totalExpensesAmount = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const net = totalReceived - totalExpensesAmount;
    const share = MEMBERS.length > 0 ? net / MEMBERS.length : 0;

    // --- PART 2: SETTLEMENT LOGIC ---
    const activeRecords = records.filter(r => !r.is_settled);
    const activeExpenses = expenses.filter(e => !e.is_settled);

    const activeReceived = activeRecords
      .filter(r => r.status === 'Paid')
      .reduce((sum, r) => sum + Number(r.amount_paid || 0), 0);
    const activeExpenseTotal = activeExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const activeNet = activeReceived - activeExpenseTotal;
    const activeSplit = MEMBERS.length > 0 ? activeNet / MEMBERS.length : 0;

    const memberBalances: Record<string, number> = {};
    MEMBERS.forEach(m => memberBalances[m] = 0);

    activeRecords.forEach((r) => {
      if (r.status === 'Paid' && r.collected_by && MEMBERS.includes(r.collected_by)) {
        memberBalances[r.collected_by] += Number(r.amount_paid || 0);
      }
    });

    activeExpenses.forEach((e) => {
      if (e.paid_by && MEMBERS.includes(e.paid_by)) {
        memberBalances[e.paid_by] -= Number(e.amount || 0);
      }
    });

    const settlements = MEMBERS.map(member => {
      const holding = memberBalances[member];
      const balance = holding - activeSplit;
      return { member, holding, balance };
    });

    const transactions: any[] = [];
    const debtors = settlements.filter(s => s.balance > 1).sort((a, b) => b.balance - a.balance);
    const creditors = settlements.filter(s => s.balance < -1).sort((a, b) => a.balance - b.balance);

    let dIndex = 0;
    let cIndex = 0;
    const activeDebtors = debtors.map(d => ({ ...d }));
    const activeCreditors = creditors.map(c => ({ ...c }));

    while (dIndex < activeDebtors.length && cIndex < activeCreditors.length) {
      const debtor = activeDebtors[dIndex];
      const creditor = activeCreditors[cIndex];
      const amount = Math.min(debtor.balance, Math.abs(creditor.balance));
      if (amount > 1) {
        transactions.push({ from: debtor.member, to: creditor.member, amount: Math.round(amount) });
      }
      debtor.balance -= amount;
      creditor.balance += amount;
      if (debtor.balance < 1) dIndex++;
      if (Math.abs(creditor.balance) < 1) cIndex++;
    }

    return {
      received: totalReceived,
      totalExpenses: totalExpensesAmount,
      net: net,
      split: share,
      settlements,
      transactions
    };
  }, [records, expenses]);

  // --- HANDLERS ---
  const handleSettleUp = async () => {
    setSubmitting(true);
    try {
      await api.settleUp(currentMonth, familyId);
      await refreshData(true);
    } catch (err) {
      console.error("Failed to settle up", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPaymentModal = (shop: Shop, currentRecord: RentRecord | null, outstandingBalance: number) => {
    setSelectedShop(shop);
    if (currentRecord) { setPaymentAmount(currentRecord.amount_paid.toString()); setPaymentCollector(currentRecord.collected_by || MEMBERS[0]); }
    else { setPaymentAmount(outstandingBalance.toString()); setPaymentCollector(MEMBERS[0]); }
    setPaymentModalOpen(true);
  };

  const submitPayment = async () => {
    if (!selectedShop || !paymentAmount) return;
    setSubmitting(true);
    try {
      const res = await api.toggleRent(currentMonth, selectedShop.id, Number(paymentAmount), paymentCollector, familyId);
      setRecords(res.rentRecords);
      setPaymentModalOpen(false); setSelectedShop(null);
    } catch (err) { console.error("Payment failed", err); } finally { setSubmitting(false); }
  };

  const clearPayment = async (shopId: string) => {
    setProcessingId(shopId);
    try {
      const res = await api.toggleRent(currentMonth, shopId, 0, MEMBERS[0], familyId);
      setRecords(res.rentRecords);
    } catch (err) { console.error("Clear failed", err); } finally { setProcessingId(null); }
  };

  const handleDownloadPdf = async () => await generatePDF(shops, records, expenses, currentMonth, monthlyData, 'download', familyId);
  const handleShare = async () => await generatePDF(shops, records, expenses, currentMonth, monthlyData, 'share', familyId);

  // Copies shops from the user's most recent month into the current (empty) month
  const handleSeedShops = async () => {
    setSubmitting(true);
    try {
      const latestShops = await api.getLatestShops(familyId, currentMonth);
      if (latestShops && latestShops.length > 0) {
        for (const shop of latestShops) {
          await api.addShop(currentMonth, { name: shop.name, baseRent: shop.base_rent }, familyId);
        }
      }
      await refreshData(true);
    } catch (err) {
      console.error("Failed to seed shops", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveShop = async () => {
    if (!newShopName || !newShopRent) return;
    setSubmitting(true);
    try {
      if (editingShopId) { await api.updateShop(currentMonth, editingShopId, { name: newShopName, baseRent: Number(newShopRent) }, familyId); setEditingShopId(null); }
      else { await api.addShop(currentMonth, { name: newShopName, baseRent: Number(newShopRent) }, familyId); }
      setNewShopName(''); setNewShopRent(''); await refreshData(true);
    } catch (err) { console.error("Failed to save shop.", err); } finally { setSubmitting(false); }
  };

  const deleteShop = async (id: string) => { setProcessingId(id); await api.deleteShop(currentMonth, id, familyId); await refreshData(true); setProcessingId(null); };

  const addExpense = async () => {
    if (!newExpenseDesc || !newExpenseAmount) return;
    setSubmitting(true);
    try { await api.addExpense(currentMonth, { description: newExpenseDesc, amount: Number(newExpenseAmount), paidBy: newExpensePayer }, familyId); setNewExpenseDesc(''); setNewExpenseAmount(''); setIsCustomExpense(false); await refreshData(true); }
    catch (err) { console.error("Failed to add expense.", err); } finally { setSubmitting(false); }
  };

  const deleteExpense = async (id: string) => { setProcessingId(id); await api.deleteExpense(currentMonth, id, familyId); await refreshData(true); setProcessingId(null); };

  const changeMonth = (delta: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    setCurrentMonth(new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7));
  };

  if (loading) return (<div className="flex flex-col items-center justify-center h-screen bg-gray-50 gap-4"> <Loader2 className="animate-spin text-indigo-600" size={48} /> <p className="text-gray-500 font-medium animate-pulse">Loading Dashboard...</p> </div>);

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans pb-24 pt-8 md:pt-0 relative selection:bg-indigo-100 selection:text-indigo-900">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); body { font-family: 'Plus Jakarta Sans', sans-serif; }`}</style>

      {/* PAYMENT MODAL */}
      {paymentModalOpen && selectedShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center items-end sm:items-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in duration-300">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white relative overflow-hidden">
              <h3 className="text-sm font-bold opacity-80 uppercase tracking-widest mb-1">Record Payment</h3>
              <h2 className="text-3xl font-black tracking-tight">{selectedShop.name}</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="block text-slate-400 font-bold text-[10px] uppercase tracking-wider">Base Rent</span><span className="font-mono font-bold text-slate-700 text-lg">₹{formatCurrency(selectedShop.base_rent)}</span></div>
                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100"><span className="block text-rose-400 font-bold text-[10px] uppercase tracking-wider">Arrears</span><span className="font-mono font-bold text-rose-600 text-lg">₹{formatCurrency(arrears[selectedShop.name] || 0)}</span></div>
              </div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Amount Collected</label><div className="relative group"><span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">₹</span><input type="number" className="w-full pl-10 pr-4 h-16 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 font-bold text-2xl text-slate-800 transition-all shadow-sm" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} autoFocus placeholder="0" /></div></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Collected By</label><div className="flex gap-2 bg-slate-100/50 p-1.5 rounded-2xl">{MEMBERS.map(m => (<button key={m} onClick={() => setPaymentCollector(m)} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all shadow-sm ${paymentCollector === m ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5 scale-[1.02]' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}>{m}</button>))}</div></div>
              <div className="pt-2 flex gap-3"><button onClick={() => setPaymentModalOpen(false)} className="flex-1 h-14 rounded-2xl font-bold text-slate-500 hover:bg-slate-100">Cancel</button><button onClick={submitPayment} disabled={submitting} className="flex-[2] h-14 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2 active:scale-95">{submitting ? <Loader2 className="animate-spin" /> : <Save size={20} />}Save Payment</button></div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200"> <Building2 size={22} /> </div><div><h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">{familyId}'s Rental</h1><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Group: {familyId}</p></div></div>
          <div className="flex items-center bg-slate-100 rounded-2xl p-1.5 w-full md:w-auto justify-between sm:justify-center ring-1 ring-slate-200 order-last md:order-none"><button onClick={() => changeMonth(-1)} className="h-10 w-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-slate-600 hover:text-indigo-600 active:scale-90"> <ChevronLeft size={18} /> </button><div className="px-6 text-center flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Period</span><span className="font-bold text-slate-800 text-sm whitespace-nowrap"> {new Date(currentMonth + '-01').toLocaleDateString('default', { month: 'short', year: 'numeric' })} </span></div><button onClick={() => changeMonth(1)} className="h-10 w-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-slate-600 hover:text-indigo-600 active:scale-90"> <ChevronRight size={18} /> </button></div>
          <div className="w-full md:w-auto"><div className="hidden md:flex justify-end gap-2"><button onClick={handleDownloadPdf} className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md text-sm whitespace-nowrap"> <Download size={18} /> <span>PDF</span> </button><button onClick={onLogout} className="p-3 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all" title="Logout"> <LogOut size={20} /> </button></div><div className="flex md:hidden gap-2"><button onClick={handleShare} className="flex-[4] h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center gap-2 font-bold shadow-md shadow-emerald-100 active:scale-95 transition-all"> <Share2 size={20} /> Share</button><button onClick={onLogout} className="flex-1 h-12 bg-slate-100 text-slate-500 border border-slate-200 rounded-2xl flex items-center justify-center active:scale-95 transition-all"> <LogOut size={20} /></button></div></div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-8">

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"><StatCard title="Received" value={monthlyData.received} type="success" icon={TrendingUp} /><StatCard title="Expenses" value={monthlyData.totalExpenses} type="danger" icon={Receipt} /><StatCard title="Net Balance" value={monthlyData.net} type="primary" icon={Wallet} /><StatCard title={`Share (1/${MEMBERS.length})`} value={monthlyData.split} type="warning" icon={Users} /></div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">

            {/* SETTLEMENT PLAN */}
            <section className="bg-slate-900 rounded-[2rem] shadow-2xl shadow-indigo-900/20 p-6 sm:p-8 text-white relative overflow-hidden transition-all">
              <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><ArrowRightLeft size={180} /></div>

              <div className="relative z-10">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-slate-400">
                    <span className="p-1 bg-indigo-500/20 rounded-lg"><ArrowRightLeft size={14} className="text-indigo-400" /></span>Settlement Plan
                  </h2>
                  {monthlyData.transactions.length > 0 && (
                    <button
                      onClick={handleSettleUp}
                      disabled={submitting}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                    >
                      {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                      Mark All Settled
                    </button>
                  )}
                </div>

                <div className="grid gap-4">
                  {monthlyData.transactions.length > 0 ? (
                    monthlyData.transactions.map((t: any, idx) => {
                      const upiId = memberUpiIds[t.to] || '';
                      // Standard UPI per-transaction limit is ₹1,00,000
                      // (UPI Lite has a ₹500 PIN-less limit; that's a different product)
                      const UPI_LIMIT = 100000;
                      const exceedsLimit = t.amount >= UPI_LIMIT;
                      const monthLabel = new Date(currentMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                      const upiNote = encodeURIComponent(`Rent settlement ${monthLabel}`);
                      const upiUri = upiId
                        ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(t.to)}&am=${t.amount}&cu=INR&tn=${upiNote}`
                        : '';
                      const isQrOpen = expandedQr === idx;

                      return (
                        <div key={idx} className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden">
                          {/* Main row */}
                          <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
                              <div className="bg-rose-500/20 text-rose-300 px-3 py-1.5 rounded-lg font-bold text-xs uppercase w-28 text-center">{t.from}</div>
                              <span className="text-white/40 text-[10px] font-bold">PAYS</span>
                              <div className="bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg font-bold text-xs uppercase w-28 text-center">{t.to}</div>
                            </div>
                            <div className="font-black text-xl font-mono tracking-tight">₹{formatCurrency(t.amount)}</div>
                          </div>

                          {/* UPI Action area */}
                          <div className="px-4 pb-4">
                            {upiId && !exceedsLimit ? (
                              <div className="flex flex-col gap-2">
                                {/* Buttons row — always shown when UPI ID exists and under ₹1L */}
                                <div className="flex flex-wrap gap-2 items-center">
                                  <button
                                    onClick={() => { window.location.href = upiUri; }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-lg shadow-indigo-900/30"
                                  >
                                    <Smartphone size={14} />
                                    Pay via UPI
                                  </button>
                                  <button
                                    onClick={() => setExpandedQr(isQrOpen ? null : idx)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs transition-all active:scale-95"
                                  >
                                    <QrCode size={14} />
                                    {isQrOpen ? 'Hide QR' : 'Show QR'}
                                  </button>
                                </div>
                                {/* SBI advisory — shown for amounts > ₹2,000 */}
                                {t.amount > 2000 && (
                                  <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                    <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                      <p className="text-amber-300 text-[11px] font-bold">⚠️ SBI users: ₹2,000 per-transaction limit</p>
                                      <p className="text-amber-400/80 text-[10px] leading-relaxed">To pay ₹{formatCurrency(t.amount)}, you can:</p>
                                      <ul className="text-amber-400/80 text-[10px] space-y-0.5 pl-2">
                                        <li>• Split into <span className="text-amber-300 font-bold">{Math.ceil(t.amount / 2000)} payments</span> of ≤₹2,000 via SBI UPI</li>
                                        <li>• Use <span className="text-amber-300 font-bold">NEFT/IMPS</span> in YONO SBI (no ₹2,000 cap)</li>
                                        <li>• Pay via Google Pay/PhonePe on <span className="text-amber-300 font-bold">HDFC, ICICI or Axis</span> (limit ₹1,00,000)</li>
                                        <li>• Raise limit: <span className="text-amber-300 font-bold">YONO SBI → UPI → Settings → Transaction Limit</span></li>
                                      </ul>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : upiId && exceedsLimit ? (
                              /* Amount exceeds absolute UPI limit of ₹1,00,000 */
                              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-500/15 border border-amber-500/20 rounded-xl">
                                <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
                                <p className="text-amber-300 text-xs font-medium">
                                  Exceeds UPI per-transaction limit (₹1,00,000) — split the payment or use bank transfer
                                </p>
                              </div>
                            ) : (
                              /* No UPI ID set for receiver */

                              <p className="text-slate-500 text-xs font-medium italic">
                                Ask {t.to} to add their UPI ID
                              </p>
                            )}

                            {/* QR Code panel */}
                            {isQrOpen && upiId && !exceedsLimit && (
                              <div className="mt-3 flex flex-col items-center gap-4 bg-slate-900/90 border border-white/10 rounded-3xl p-5 animate-in fade-in zoom-in duration-200">
                                {/* Label */}
                                <div className="text-center space-y-1">
                                  <p className="text-white text-xs font-black uppercase tracking-wider">Pay ₹{formatCurrency(t.amount)} to {t.to}</p>
                                  <p className="text-slate-400 text-[10px] max-w-[280px] mx-auto leading-normal">
                                    📸 <span className="text-indigo-400 font-bold">Tap the QR code</span> to save to gallery & open your UPI app automatically.
                                  </p>
                                </div>

                                {/* Tappable QR — clicking downloads the QR code as image and launches UPI app */}
                                <div
                                  onClick={() => handleDownloadAndPay(`upi-qr-canvas-${idx}`, t.amount, t.to)}
                                  title="Tap to download QR and pay"
                                  className="block rounded-2xl p-4 bg-white border border-white/10 active:scale-95 transition-all cursor-pointer shadow-lg hover:shadow-indigo-500/20"
                                >
                                  <QRCodeCanvas
                                    id={`upi-qr-canvas-${idx}`}
                                    value={upiUri}
                                    size={180}
                                    bgColor="#ffffff"
                                    fgColor="#0f172a"
                                    level="H"
                                    includeMargin={false}
                                  />
                                </div>

                                {/* UPI ID + amount labels */}
                                <div className="text-center space-y-0.5">
                                  <p className="text-slate-400 text-[10px] font-mono break-all">{upiId}</p>
                                  <p className="text-indigo-400 text-sm font-black">₹{formatCurrency(t.amount)}</p>
                                </div>

                                {/* Quick instructions */}
                                <div className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-3 text-[10px] text-slate-300 leading-normal space-y-1">
                                  <p className="font-bold text-amber-400">SBI / High Amount Gallery Pay Instructions:</p>
                                  <p>1. Tap the QR image above to download it.</p>
                                  <p>2. Open your preferred payment app below.</p>
                                  <p>3. Tap <span className="font-semibold text-white">"Scan QR"</span> inside the app, tap the <span className="font-semibold text-white">Gallery/Photos icon</span>, and choose the downloaded image to pay!</p>
                                </div>

                                {/* Action Buttons */}
                                <div className="w-full flex flex-col gap-2">
                                  <button
                                    onClick={() => handleDownloadAndPay(`upi-qr-canvas-${idx}`, t.amount, t.to)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-lg shadow-indigo-900/30"
                                  >
                                    <Download size={13} />
                                    Download QR Image
                                  </button>

                                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                                    <button
                                      onClick={() => handleDownloadAndPay(`upi-qr-canvas-${idx}`, t.amount, t.to, 'phonepe://')}
                                      className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-purple-600/20 hover:bg-purple-600/35 text-purple-300 border border-purple-500/20 rounded-xl transition-all active:scale-95"
                                    >
                                      <span className="text-[10px] font-bold">PhonePe</span>
                                    </button>
                                    <button
                                      onClick={() => handleDownloadAndPay(`upi-qr-canvas-${idx}`, t.amount, t.to, 'gpay://')}
                                      className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-blue-600/20 hover:bg-blue-600/35 text-blue-300 border border-blue-500/20 rounded-xl transition-all active:scale-95"
                                    >
                                      <span className="text-[10px] font-bold">Google Pay</span>
                                    </button>
                                    <button
                                      onClick={() => handleDownloadAndPay(`upi-qr-canvas-${idx}`, t.amount, t.to, 'paytmmp://')}
                                      className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-sky-600/20 hover:bg-sky-600/35 text-sky-300 border border-sky-500/20 rounded-xl transition-all active:scale-95"
                                    >
                                      <span className="text-[10px] font-bold">Paytm</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })
                  ) : (
                    MEMBERS.map((member, idx) => (
                      <div key={idx} className="bg-white/5 backdrop-blur-md rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between border border-white/5 gap-3 opacity-50">
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
                          <div className="bg-white/10 text-slate-300 px-3 py-1.5 rounded-lg font-bold text-xs uppercase w-28 text-center">{member}</div>
                          <span className="text-white/40 text-[10px] font-bold">PAYS</span>
                          <div className="bg-white/10 text-slate-300 px-3 py-1.5 rounded-lg font-bold text-xs uppercase w-28 text-center">-</div>
                        </div>
                        <div className="font-black text-xl font-mono tracking-tight text-white/30">₹0</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* SHOP STATUS */}
            <section className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-indigo-100/50 border border-white/20 overflow-hidden ring-1 ring-slate-100">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/50"> <h2 className="text-lg font-black flex items-center gap-3 text-slate-800"><div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-200 text-white"><Building2 size={20} /></div>Shop Status</h2> {shops.length === 0 && hasAnyShops && (<button onClick={handleSeedShops} disabled={submitting} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 disabled:opacity-50"> {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Copy Shops </button>)} </div>
              <div className="md:hidden p-4 space-y-4 bg-slate-50/50">{shops.map((shop) => { const record = records.find((r) => r.shop_id === shop.id); const isPaid = !!record; const pastDue = arrears[shop.name] || 0; const totalObligation = shop.base_rent + pastDue; const paidAmount = record?.amount_paid || 0; const outstandingBalance = totalObligation - paidAmount; return (<div key={shop.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4 relative"> <div className="flex justify-between items-start"> <div><h3 className="font-bold text-slate-900 text-lg">{shop.name}</h3><p className="text-sm text-slate-400 font-mono mt-0.5">Rent: ₹{formatCurrency(shop.base_rent)}</p></div> <div className="flex gap-2 items-center"> {isPaid && (<div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Paid</div>)} <button onClick={() => { setEditingShopId(shop.id); setNewShopName(shop.name); setNewShopRent(shop.base_rent.toString()); }} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors"><Pencil size={16} /></button> <button onClick={() => deleteShop(shop.id)} className="p-2 bg-rose-50 text-rose-400 hover:text-rose-600 rounded-lg transition-colors"><Trash2 size={16} /></button> </div> </div> <div className="bg-slate-50/80 p-4 rounded-xl space-y-4"> <div className="flex justify-between items-center border-b border-slate-200 pb-4"> <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">ARREARS</span> {pastDue > 0 ? (<span className="text-rose-600 font-black text-lg mt-1">₹{formatCurrency(pastDue)}</span>) : (<span className="text-emerald-600 font-bold text-sm mt-1 flex items-center gap-1"><CheckCircle2 size={12} /> Clear</span>)} </div> <div className="flex flex-col items-end"><span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">DUE</span><span className={`font-bold text-lg ${outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₹{formatCurrency(outstandingBalance)}</span></div> </div> <div className="flex justify-between items-center"><span className="text-[10px] uppercase text-emerald-600 font-bold tracking-wider">PAID</span><span className="text-emerald-700 font-bold text-lg">₹{formatCurrency(paidAmount)}</span></div> </div> <div> {!isPaid ? (<button onClick={() => handleOpenPaymentModal(shop, record, outstandingBalance)} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 flex items-center justify-center gap-2 active:scale-95 transition-transform hover:bg-black"> <CreditCard size={18} /> Record Payment </button>) : (<div className="flex items-center gap-2"><div className="flex-grow bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center justify-between px-4"><div className="flex flex-col"><span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">PAID</span><span className="text-[11px] text-slate-400">to {record?.collected_by}</span></div><div className="text-emerald-700 font-bold font-mono text-xl">₹{formatCurrency(record.amount_paid)}</div></div><button onClick={() => handleOpenPaymentModal(shop, record, outstandingBalance)} className="h-full px-4 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-500 hover:border-indigo-100 transition-all"><Pencil size={18} /></button><button onClick={() => clearPayment(shop.id)} className="h-full px-4 bg-white border border-rose-100 text-rose-400 hover:text-rose-600 hover:border-rose-200 transition-all"><X size={18} /></button></div>)} </div> </div>) })} </div>
              <div className="hidden md:block overflow-x-auto"> <table className="w-full text-left min-w-[700px]"> <thead> <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100"> <th className="px-8 py-5 text-slate-700">Shop</th> <th className="px-6 py-5">Rent</th> <th className="px-6 py-5 text-indigo-700">Arrears</th> <th className="px-6 py-5 text-rose-700">Remaining Due</th> <th className="px-6 py-5 text-center">Payment</th> <th className="px-6 py-5 text-right">Actions</th> </tr> </thead> <tbody className="divide-y divide-slate-50"> {shops.map((shop) => { const record = records.find((r) => r.shop_id === shop.id); const isPaid = !!record; const isProcessing = processingId === shop.id; const pastDue = arrears[shop.name] || 0; const totalObligation = shop.base_rent + pastDue; const paidAmount = record?.amount_paid || 0; const outstandingBalance = totalObligation - paidAmount; return (<tr key={shop.id} className="hover:bg-slate-50 transition-colors"> <td className="px-8 py-5 font-bold text-slate-700 text-sm">{shop.name}</td> <td className="px-6 py-5 font-mono text-xs text-slate-500">₹{formatCurrency(shop.base_rent)}</td> <td className="px-6 py-5 font-mono text-xs font-bold">{pastDue > 0 ? (<span className="text-rose-600">₹{formatCurrency(pastDue)}</span>) : (<span className="text-emerald-500 opacity-80 flex items-center gap-1"><CheckCircle2 size={10} /> Clear</span>)}</td> <td className="px-6 py-5 font-mono text-sm font-bold"><span className={outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}>₹{formatCurrency(outstandingBalance)}</span></td> <td className="px-6 py-5"> <div className="flex flex-col gap-2 max-w-[240px] mx-auto"> {!isPaid ? (<button onClick={() => handleOpenPaymentModal(shop, null, outstandingBalance)} disabled={isProcessing} className="flex items-center justify-center gap-2 w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-md"> {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />} Record Payment </button>) : (<div className="flex items-center gap-2"><div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-xl p-2 flex flex-col items-center"><span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wide">PAID</span><span className="text-sm font-bold text-emerald-700 font-mono">₹{formatCurrency(record?.amount_paid)}</span><span className="text-[9px] text-slate-400 mt-0.5">{record?.collected_by}</span></div><div className="flex flex-col gap-1"><button onClick={() => handleOpenPaymentModal(shop, record, outstandingBalance)} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 transition-colors"> <Pencil size={14} /> </button><button onClick={() => clearPayment(shop.id)} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors"> <X size={14} /> </button></div></div>)} </div> </td> <td className="px-6 py-5 text-right"> <div className="flex justify-end gap-2"> <button onClick={() => { setEditingShopId(shop.id); setNewShopName(shop.name); setNewShopRent(shop.base_rent.toString()); }} className="text-slate-300 hover:text-indigo-500 p-2"><Pencil size={16} /></button> <button onClick={() => deleteShop(shop.id)} className="text-slate-300 hover:text-rose-500 p-2" disabled={isProcessing}> {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} </button> </div> </td> </tr>); })} </tbody> </table> </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100"> <div className="flex flex-col sm:flex-row gap-3"> <div className="w-full"> <input type="text" placeholder="Shop Name" className="w-full px-5 h-14 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none text-sm font-bold shadow-sm" value={newShopName} onChange={(e) => setNewShopName(e.target.value)} /> </div> <div className="flex gap-3 w-full sm:w-auto"> <div className="flex-grow sm:w-40"> <input type="number" placeholder="Rent" className="w-full px-5 h-14 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none text-sm font-bold shadow-sm" value={newShopRent} onChange={(e) => setNewShopRent(e.target.value)} /> </div> <button onClick={handleSaveShop} disabled={submitting} className="h-14 px-8 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 text-sm shadow-xl shadow-slate-200 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"> {submitting ? <Loader2 size={18} className="animate-spin" /> : (editingShopId ? <Save size={18} /> : <Plus size={18} />)} {editingShopId ? 'Update' : 'Add Shop'} </button> {editingShopId && (<button onClick={() => { setEditingShopId(null); setNewShopName(''); setNewShopRent(''); }} className="h-14 w-14 flex items-center justify-center bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-rose-500"> <X size={20} /> </button>)} </div> </div> </div>
            </section>

            {/* EXPENSES */}
            <section className="bg-white rounded-[2.5rem] shadow-2xl p-6 sm:p-8 border border-slate-100 relative overflow-hidden group">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-3 text-slate-800 relative z-10"> <div className="p-2.5 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200"> <CreditCard size={22} /> </div> Quick Expense Record </h3>
              <div className="flex flex-col gap-6 relative z-10">
                <div> <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 block mb-2.5 tracking-widest">Description</label> <div className="relative group">{isCustomExpense ? (<div className="relative animate-in fade-in zoom-in duration-200"><input type="text" autoFocus placeholder="What did you pay for?" className="w-full pl-5 pr-14 h-16 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-violet-500 outline-none text-slate-700 font-bold text-lg transition-all shadow-sm" value={newExpenseDesc} onChange={(e) => setNewExpenseDesc(e.target.value)} /><button onClick={() => setIsCustomExpense(false)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white text-slate-400 hover:text-rose-500 rounded-xl border border-slate-100 shadow-sm"> <List size={20} /> </button></div>) : (<div className="relative group/select"><select className="w-full appearance-none pl-5 pr-12 h-16 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-violet-500 outline-none text-slate-700 font-bold text-lg transition-all cursor-pointer shadow-sm" value={newExpenseDesc} onChange={(e) => { if (e.target.value === 'CUSTOM_ENTRY_TRIGGER') { setIsCustomExpense(true); setNewExpenseDesc(''); } else { setNewExpenseDesc(e.target.value); } }}> <option value="">Select Category</option> <option value="CUSTOM_ENTRY_TRIGGER" className="font-bold text-violet-600 bg-violet-50">Custom</option>{PREDEFINED_EXPENSES.map(exp => (<option key={exp} value={exp} className="text-slate-700 font-medium py-2">{exp}</option>))}</select> <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"> <ChevronRight size={20} className="rotate-90" /> </div></div>)}</div></div>
                <div className="flex gap-4"> <div className="w-1/2"> <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 block mb-2.5 tracking-widest">Amount</label> <div className="relative group/amount"><span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">₹</span><input type="number" placeholder="0" className="w-full pl-10 pr-4 h-16 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-violet-500 outline-none text-slate-800 font-black text-2xl transition-all shadow-sm" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)} /> </div></div> <div className="w-1/2"> <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 block mb-2.5 tracking-widest">Paid By</label> <div className="relative group/payer"><select className="w-full appearance-none pl-5 pr-12 h-16 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-violet-500 outline-none text-slate-700 font-bold text-lg transition-all cursor-pointer shadow-sm" value={newExpensePayer} onChange={(e) => setNewExpensePayer(e.target.value)}> {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)} </select> <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"> <UserCircle size={22} /> </div></div></div> </div>
                <button onClick={addExpense} disabled={submitting || !newExpenseDesc || !newExpenseAmount} className="w-full h-16 mt-2 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-3 text-base shadow-xl shadow-slate-300 disabled:opacity-50" > {submitting ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />} Record Expense </button>
              </div>
            </section>

            <section className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between"> <h2 className="text-lg font-bold flex items-center gap-3 text-slate-800"><div className="p-2.5 bg-rose-50 rounded-2xl text-rose-500 border border-rose-100"><Receipt size={22} /></div>Expenditures</h2> <div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-xs font-bold tracking-wide border border-rose-100">Total: ₹{formatCurrency(monthlyData.totalExpenses)}</div> </div>
              <div className="p-4 space-y-3"> {expenses.length === 0 ? (<p className="text-center py-10 text-slate-400 text-sm font-medium italic">No expenses recorded for this month.</p>) : (expenses.map((exp) => (<div key={exp.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm gap-3"> <div className="flex items-center gap-4"> <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100"><Receipt size={20} /></div> <div> <p className="font-bold text-slate-700 text-sm">{exp.description}</p> <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">Paid by <span className="text-indigo-500">{exp.paid_by}</span></p> </div> </div> <div className="flex items-center gap-4"> <span className="font-bold text-rose-500 text-lg font-mono">-₹{formatCurrency(exp.amount)}</span> <button onClick={() => deleteExpense(exp.id)} disabled={processingId === exp.id} className="p-2 text-slate-300 hover:text-rose-500 rounded-xl"> {processingId === exp.id ? <Loader2 size={18} className="animate-spin text-rose-500" /> : <Trash2 size={18} />} </button> </div> </div>)))} </div>
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-white rounded-[2rem] shadow-xl p-6 border border-slate-100">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-3"><div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100"><UserCircle size={22} /></div>Balance Sheet</h3>
              <div className="space-y-3">
                {monthlyData.settlements.map((s, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="text-sm font-bold text-slate-700">{s.member}</div>
                    <div className={`text-xs font-mono font-bold px-3 py-1 rounded-lg ${s.balance > 0 ? 'bg-rose-100 text-rose-600' : s.balance < 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                      {s.balance > 1 ? `Pays ₹${formatCurrency(s.balance)}` : s.balance < -1 ? `Gets ₹${formatCurrency(Math.abs(s.balance))}` : 'Settled'}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* UPI IDs settings panel */}
            <section className="bg-white rounded-[2rem] shadow-xl p-6 border border-slate-100">
              <h3 className="text-lg font-bold mb-1 flex items-center gap-3">
                <div className="p-2.5 bg-violet-50 rounded-2xl text-violet-600 border border-violet-100"><Smartphone size={22} /></div>
                UPI IDs
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mb-5 ml-1">Tap ✏️ to add or edit any member's UPI ID</p>
              <div className="space-y-3">
                {MEMBERS.map((member) => {
                  const savedUpi = memberUpiIds[member] || '';
                  const isEditing = editingUpiMember === member;
                  return (
                    <div key={member} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-slate-700">{member}</span>
                        {!isEditing && (
                          <button
                            onClick={() => { setEditingUpiMember(member); setUpiEditValue(savedUpi); }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title={savedUpi ? 'Edit UPI ID' : 'Add UPI ID'}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            placeholder="e.g. name@ybl"
                            value={upiEditValue}
                            onChange={(e) => setUpiEditValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Escape' && setEditingUpiMember(null)}
                            className="flex-1 h-10 px-3 bg-white border-2 border-indigo-300 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium text-slate-700 transition-all"
                            autoFocus
                          />
                          <button
                            onClick={async () => {
                              setSavingUpi(true);
                              try {
                                const updated = await api.saveUserUpiId(user.id, familyId, member, upiEditValue.trim());
                                setMemberUpiIds(updated);
                                setEditingUpiMember(null);
                              } catch (e) {
                                console.error('Failed to save UPI ID', e);
                              } finally {
                                setSavingUpi(false);
                              }
                            }}
                            disabled={savingUpi}
                            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1 disabled:opacity-60"
                          >
                            {savingUpi ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Save
                          </button>
                          <button
                            onClick={() => setEditingUpiMember(null)}
                            className="h-10 px-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          {savedUpi ? (
                            <>
                              <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">{savedUpi}</span>
                              <CheckCircle2 size={12} className="text-emerald-500" />
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Not set — tap ✏️ to add</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100/50 flex gap-4 shadow-sm">
              <AlertCircle size={24} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider">Important Note</h4>
                <p className="text-[11px] text-amber-700/80 leading-relaxed font-medium">
                  All changes are synced in real-time. Rent is split equally (1/3) after deducting expenses. Ensure all payments are recorded accurately.
                </p>
              </div>
            </div>

            <div className="pb-8">
              <button onClick={handleShare} className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-emerald-600 text-white rounded-3xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 text-base">
                <Share2 size={22} />
                <span>Share via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-sm w-11/12">
          <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3">
            <CheckCircle2 className="text-emerald-400 flex-shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-200">QR Code Saved!</p>
              <p className="text-[11px] text-slate-400 leading-normal">{toast.message}</p>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-500 hover:text-slate-300 ml-auto">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, type, icon: Icon }: any) => {
  const styles: Record<string, any> = { success: { border: "border-emerald-100", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", textColor: "text-emerald-700" }, danger: { border: "border-rose-100", iconBg: "bg-rose-50", iconColor: "text-rose-600", textColor: "text-rose-700" }, primary: { border: "border-indigo-100", iconBg: "bg-indigo-50", iconColor: "text-indigo-600", textColor: "text-indigo-700" }, warning: { border: "border-amber-100", iconBg: "bg-amber-50", iconColor: "text-amber-600", textColor: "text-amber-700" } };
  const style = styles[type];
  return (<div className={`bg-white p-5 rounded-3xl border ${style.border} shadow-lg shadow-slate-200/40 flex flex-col justify-between min-h-[110px] transition-all hover:-translate-y-1 hover:shadow-xl`}> <div className="flex justify-between items-start mb-2"> <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p> <div className={`p-2 rounded-xl ${style.iconBg} ${style.iconColor}`}><Icon size={16} /></div> </div> <h3 className={`text-2xl font-bold tracking-tighter ${style.textColor}`}>₹{formatCurrency(Math.abs(value))}</h3> </div>);
};

export default Dashboard;
