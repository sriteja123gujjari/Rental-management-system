import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Receipt, Wallet, Users, Download, Plus, Trash2, 
  ChevronLeft, ChevronRight, TrendingUp, CreditCard, 
  Loader2, ArrowRightLeft, UserCircle, Save, AlertCircle, Pencil, X, LogOut, Share2, List
} from 'lucide-react';
import { api } from '../services/api';
import { generatePDF } from '../services/pdf';

// Define types locally
interface Shop { id: string; name: string; base_rent: number; }
interface RentRecord { shop_id: string; amount_paid: number; collected_by: string; status: string; }
interface Expense { id: string; description: string; amount: number; paid_by: string; }

const MEMBERS = ['Anjaneyulu', 'Srinivas', 'Goutham'];
const DEFAULT_SHOPS_DATA = [
  { name: 'Medical Shop', baseRent: 55000 },
  { name: 'Sham Home', baseRent: 63000 },
  { name: 'Brown Bear', baseRent: 45000 },
  { name: 'Dental', baseRent: 13000 },
  { name: 'Gym', baseRent: 45000 },
  { name: 'Bhavya Clinic', baseRent: 10500 },
];

const PREDEFINED_EXPENSES = [
  "House electrical",
  "Bore",
  "Worker",
  "Internet bill",
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, style: 'decimal' }).format(amount);
};

const Dashboard = ({ user, onLogout }: { user: any, onLogout: () => void }) => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [records, setRecords] = useState<RentRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [arrears, setArrears] = useState<Record<string, number>>({});
  
  // STATES
  const [newShopName, setNewShopName] = useState('');
  const [newShopRent, setNewShopRent] = useState('');
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  
  // EXPENSE STATES
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpensePayer, setNewExpensePayer] = useState('Shared');
  const [isCustomExpense, setIsCustomExpense] = useState(false); // New state for toggling input
  
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCollector, setPaymentCollector] = useState(MEMBERS[0]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false); 
  const [processingId, setProcessingId] = useState<string | null>(null); 

  const refreshData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.fetchMonthData(currentMonth);
      setShops(data.shops || []);
      setRecords(data.rentRecords || []);
      setExpenses(data.expenses || []);
      const arrearsData = await api.fetchArrears(currentMonth);
      setArrears(arrearsData);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData(false);
  }, [currentMonth]);

  const monthlyData = useMemo(() => {
    const received = records
      .filter((r) => r.status === 'Paid')
      .reduce((sum, r) => sum + Number(r.amount_paid || 0), 0);
    
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const net = received - totalExpenses;
    const split = net / 3;

    const memberBalances: Record<string, number> = {};
    MEMBERS.forEach(m => memberBalances[m] = 0);

    records.forEach((r) => {
      if (r.status === 'Paid' && r.collected_by && MEMBERS.includes(r.collected_by)) {
        memberBalances[r.collected_by] += Number(r.amount_paid || 0);
      }
    });

    expenses.forEach((e) => {
      if (e.paid_by && MEMBERS.includes(e.paid_by)) {
        memberBalances[e.paid_by] -= Number(e.amount || 0);
      }
    });

    const settlements = MEMBERS.map(member => {
      const holding = memberBalances[member];
      const balance = holding - split; 
      return { member, holding, balance };
    });

    const transactions: any[] = [];
    const debtors = settlements.filter(s => s.balance > 1).sort((a, b) => b.balance - a.balance);
    const creditors = settlements.filter(s => s.balance < -1).sort((a, b) => a.balance - b.balance);
    
    let dIndex = 0;
    let cIndex = 0;
    const activeDebtors = debtors.map(d => ({...d}));
    const activeCreditors = creditors.map(c => ({...c}));

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

    return { received, totalExpenses, net, split, settlements, transactions };
  }, [records, expenses]);

  // --- HANDLERS ---
  const handleOpenPaymentModal = (shop: Shop, currentRecord: RentRecord | null, outstandingBalance: number) => {
    setSelectedShop(shop);
    if (currentRecord) {
      setPaymentAmount(currentRecord.amount_paid.toString());
      setPaymentCollector(currentRecord.collected_by || MEMBERS[0]);
    } else {
      setPaymentAmount(outstandingBalance.toString());
      setPaymentCollector(MEMBERS[0]);
    }
    setPaymentModalOpen(true);
  };

  const submitPayment = async () => {
    if (!selectedShop || !paymentAmount) return;
    setSubmitting(true);
    try {
      const res = await api.toggleRent(currentMonth, selectedShop.id, Number(paymentAmount), paymentCollector);
      setRecords(res.rentRecords);
      setPaymentModalOpen(false);
      setSelectedShop(null);
    } catch (err) {
      console.error("Payment failed", err);
      alert("Failed to save payment");
    } finally {
      setSubmitting(false);
    }
  };

  const clearPayment = async (shopId: string) => {
    if(!confirm("Are you sure you want to clear this payment?")) return;
    setProcessingId(shopId);
    try {
      const res = await api.toggleRent(currentMonth, shopId, 0, MEMBERS[0]); 
      setRecords(res.rentRecords);
    } catch(err) {
      console.error("Clear failed", err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDownloadPdf = () => generatePDF(shops, records, expenses, currentMonth, monthlyData);
  
  const handleShare = async () => {
    if (navigator.share) {
       await navigator.share({ title: 'RentFlow', text: `Rent Report ${currentMonth}`, url: window.location.href });
    } else {
      alert("Use browser share menu");
    }
  };

  const handleSeedShops = async () => { 
    setSubmitting(true); 
    for (const shopData of DEFAULT_SHOPS_DATA) { 
      const shop = { name: shopData.name, baseRent: shopData.baseRent }; 
      await api.addShop(currentMonth, shop); 
    } 
    await refreshData(true); 
    setSubmitting(false); 
  };

  const handleSaveShop = async () => { 
    if (!newShopName || !newShopRent) return; 
    setSubmitting(true); 
    try { 
      if (editingShopId) { 
        await api.updateShop(currentMonth, editingShopId, { name: newShopName, baseRent: Number(newShopRent) }); 
        setEditingShopId(null); 
      } else { 
        const shop = { name: newShopName, baseRent: Number(newShopRent) }; 
        await api.addShop(currentMonth, shop); 
      } 
      setNewShopName(''); 
      setNewShopRent(''); 
      await refreshData(true); 
    } catch (err) { 
      console.error("Error saving shop:", err); 
      alert("Failed to save shop."); 
    } finally { 
      setSubmitting(false); 
    } 
  };

  const deleteShop = async (id: string) => { 
    setProcessingId(id); 
    await api.deleteShop(currentMonth, id); 
    await refreshData(true); 
    setProcessingId(null); 
  };

  const addExpense = async () => { 
    if (!newExpenseDesc || !newExpenseAmount) return; 
    setSubmitting(true); 
    try { 
      const expense = { description: newExpenseDesc, amount: Number(newExpenseAmount), paidBy: newExpensePayer }; 
      await api.addExpense(currentMonth, expense); 
      
      // Reset form
      setNewExpenseDesc(''); 
      setNewExpenseAmount(''); 
      setIsCustomExpense(false); // Reset custom toggle
      
      await refreshData(true); 
    } catch (err) { 
      console.error("Error adding expense:", err); 
      alert("Failed to add expense."); 
    } finally { 
      setSubmitting(false); 
    } 
  };

  const deleteExpense = async (id: string) => { 
    setProcessingId(id); 
    await api.deleteExpense(currentMonth, id); 
    await refreshData(true); 
    setProcessingId(null); 
  };

  const changeMonth = (delta: number) => { 
    const [year, month] = currentMonth.split('-').map(Number); 
    const date = new Date(Date.UTC(year, month - 1 + delta, 1)); 
    setCurrentMonth(date.toISOString().slice(0, 7)); 
  };

  if (loading) return ( 
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 gap-4"> 
      <Loader2 className="animate-spin text-indigo-600" size={48} /> 
      <p className="text-gray-500 font-medium">Fetching Data...</p> 
    </div> 
  );

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans pb-12 relative">
      
      {/* PAYMENT MODAL */}
      {paymentModalOpen && selectedShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 m-4">
            <div className="bg-indigo-600 p-6 text-white">
              <h3 className="text-lg font-bold opacity-80">Record Payment</h3>
              <h2 className="text-2xl font-black">{selectedShop.name}</h2>
            </div>
            <div className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4 text-sm">
                 <div className="bg-slate-50 p-3 rounded-xl border">
                   <span className="block text-slate-400 font-bold text-[10px] uppercase">Base Rent</span>
                   <span className="font-mono font-bold text-slate-700">₹{formatCurrency(selectedShop.base_rent)}</span>
                 </div>
                 <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                   <span className="block text-rose-400 font-bold text-[10px] uppercase">Arrears</span>
                   <span className="font-mono font-bold text-rose-600">₹{formatCurrency(arrears[selectedShop.name] || 0)}</span>
                 </div>
               </div>
               
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount Collected</label>
                 <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                   <input 
                     type="number" 
                     className="w-full pl-8 pr-4 h-12 rounded-xl border-2 border-indigo-100 focus:border-indigo-500 focus:ring-0 outline-none font-bold text-lg"
                     value={paymentAmount}
                     onChange={(e) => setPaymentAmount(e.target.value)}
                     autoFocus
                   />
                 </div>
                 <p className="text-[10px] text-slate-400 mt-2 text-right">
                   Remaining Due: ₹{formatCurrency( 
                      (selectedShop.base_rent + (arrears[selectedShop.name] || 0)) - (Number(paymentAmount) || 0)
                   )}
                 </p>
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Collected By</label>
                 <div className="flex gap-2">
                   {MEMBERS.map(m => (
                     <button
                       key={m}
                       onClick={() => setPaymentCollector(m)}
                       className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${paymentCollector === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                     >
                       {m}
                     </button>
                   ))}
                 </div>
               </div>

               <div className="pt-4 flex gap-3">
                 <button onClick={() => setPaymentModalOpen(false)} className="flex-1 h-12 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
                 <button 
                   onClick={submitPayment} 
                   disabled={submitting}
                   className="flex-1 h-12 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 flex items-center justify-center gap-2"
                 >
                   {submitting ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                   Save Payment
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:h-24 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-200"> <Building2 size={24} /> </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">Gujjari's Rental</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Group: {user?.familyId}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center bg-white rounded-xl p-1 border shadow-sm ring-1 ring-slate-100 w-full sm:w-auto justify-between sm:justify-center">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-50 rounded-lg transition-colors active:scale-95 text-slate-500"> <ChevronLeft size={20} /> </button>
              <div className="px-4 text-center border-x border-slate-100 flex-grow sm:flex-grow-0">
                 <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Period</span>
                 <span className="font-bold text-slate-800 text-sm whitespace-nowrap"> {new Date(currentMonth + '-01').toLocaleDateString('default', { month: 'short', year: 'numeric' })} </span>
              </div>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-50 rounded-lg transition-colors active:scale-95 text-slate-500"> <ChevronRight size={20} /> </button>
            </div>
            <div className="flex w-full sm:w-auto gap-2">
                <button onClick={handleDownloadPdf} className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md text-sm active:scale-95 whitespace-nowrap"> <Download size={18} /> <span>PDF</span> </button>
                <button onClick={onLogout} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100" title="Logout"> <LogOut size={20} /> </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard title="Received" value={monthlyData.received} type="success" icon={TrendingUp} />
          <StatCard title="Expenses" value={monthlyData.totalExpenses} type="danger" icon={Receipt} />
          <StatCard title="Net Balance" value={monthlyData.net} type="primary" icon={Wallet} />
          <StatCard title="Share (1/3)" value={monthlyData.split} type="warning" icon={Users} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {monthlyData.transactions.length > 0 && (
              <section className="bg-indigo-900 rounded-3xl shadow-xl p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10"><ArrowRightLeft size={120} /></div>
                <div className="relative z-10">
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-4"><ArrowRightLeft className="text-indigo-300" />Settlement Plan</h2>
                    <div className="grid gap-3">
                      {monthlyData.transactions.map((t: any, idx) => (
                        <div key={idx} className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between border border-white/5 gap-3">
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="bg-rose-500/20 text-rose-300 p-1.5 rounded-lg font-bold text-xs uppercase text-center w-24">{t.from}</div>
                                <span className="text-white/50 text-xs">pays</span>
                                <div className="bg-emerald-500/20 text-emerald-300 p-1.5 rounded-lg font-bold text-xs uppercase text-center w-24">{t.to}</div>
                            </div>
                            <div className="font-bold text-lg font-mono">₹{formatCurrency(t.amount)}</div>
                        </div>
                      ))}
                    </div>
                </div>
              </section>
            )}

            {/* --- SHOP STATUS SECTION --- */}
            <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
               <div className="p-5 border-b border-slate-50 flex items-center justify-between"> 
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Building2 className="text-indigo-500" size={20} />Shop Status</h2> 
                  {shops.length === 0 && ( <button onClick={handleSeedShops} disabled={submitting} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 disabled:opacity-50"> {submitting ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14} />} Load Default Shops </button> )} 
               </div>
               
               {/* 1. MOBILE VIEW (CARDS) */}
               <div className="md:hidden p-4 space-y-4">
                 {shops.map((shop) => {
                   const record = records.find((r) => r.shop_id === shop.id); 
                   const isPaid = !!record;
                   const pastDue = arrears[shop.name] || 0; 
                   
                   // CALCULATION LOGIC:
                   const totalObligation = shop.base_rent + pastDue; 
                   const paidAmount = record?.amount_paid || 0;
                   // Outstanding Balance = What they supposed to pay - what they paid
                   const outstandingBalance = totalObligation - paidAmount;

                   return (
                     <div key={shop.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4 relative">
                         <div className="flex justify-between items-start">
                           <div>
                              <h3 className="font-bold text-slate-800 text-lg">{shop.name}</h3>
                              <p className="text-xs text-slate-400 font-mono mt-1">Rent: ₹{formatCurrency(shop.base_rent)}</p>
                           </div>
                           <div className="flex gap-1">
                              <button onClick={() => { setEditingShopId(shop.id); setNewShopName(shop.name); setNewShopRent(shop.base_rent.toString()); }} className="p-2 bg-slate-50 text-slate-400 rounded-lg"><Pencil size={14}/></button>
                              <button onClick={() => deleteShop(shop.id)} className="p-2 bg-rose-50 text-rose-400 rounded-lg"><Trash2 size={14}/></button>
                           </div>
                         </div>
                         <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl">
                           <div>
                              <span className="text-[10px] uppercase text-slate-400 font-bold">Arrears</span>
                              <div className="text-rose-500 font-bold text-sm">{pastDue > 0 ? `+ ₹${formatCurrency(pastDue)}` : '-'}</div>
                           </div>
                           <div>
                              <span className="text-[10px] uppercase text-indigo-400 font-bold">Paid</span>
                              <div className="text-emerald-600 font-bold text-sm">₹{formatCurrency(paidAmount)}</div>
                           </div>
                           <div className="col-span-2 pt-2 border-t border-slate-200 mt-1 flex justify-between items-center">
                              <span className="text-[10px] uppercase text-slate-500 font-bold">Remaining Due</span>
                              <span className={`font-black text-lg font-mono ${outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                ₹{formatCurrency(outstandingBalance)}
                              </span>
                           </div>
                         </div>
                         <div>
                           {!isPaid || outstandingBalance > 0 ? (
                              <button onClick={() => handleOpenPaymentModal(shop, record, outstandingBalance)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 flex items-center justify-center gap-2 active:scale-95 transition-transform"> <CreditCard size={16}/> {isPaid ? 'Update Payment' : 'Record Payment'} </button>
                           ) : (
                              <div className="flex items-center gap-2">
                                 <div className="flex-grow bg-emerald-50 border border-emerald-100 p-2 rounded-xl flex items-center justify-between px-4">
                                    <div className="flex flex-col">
                                       <span className="text-[9px] font-bold text-emerald-600 uppercase">Paid</span>
                                       <span className="text-[10px] text-slate-400">to {record?.collected_by}</span>
                                    </div>
                                    <div className="text-emerald-700 font-black font-mono text-lg">₹{formatCurrency(record.amount_paid)}</div>
                                 </div>
                                 <button onClick={() => handleOpenPaymentModal(shop, record, outstandingBalance)} className="h-full px-3 bg-white border border-slate-200 rounded-xl text-slate-400"><Pencil size={16}/></button>
                                 <button onClick={() => clearPayment(shop.id)} className="h-full px-3 bg-white border border-rose-100 text-rose-400 rounded-xl"><X size={16}/></button>
                              </div>
                           )}
                         </div>
                     </div>
                   )
                 })}
               </div>
               
               {/* 2. DESKTOP VIEW (TABLE) */}
               <div className="hidden md:block overflow-x-auto"> 
                 <table className="w-full text-left min-w-[700px]"> 
                   <thead> 
                     <tr className="bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100"> 
                       <th className="px-6 py-4 text-slate-700">Shop</th> 
                       <th className="px-4 py-4">Rent</th> 
                       <th className="px-4 py-4 text-indigo-700">Arrears</th> 
                       <th className="px-4 py-4 text-rose-700">Remaining Due</th> 
                       <th className="px-4 py-4 text-center">Payment</th> 
                       <th className="px-4 py-4 text-right">Actions</th> 
                     </tr> 
                   </thead> 
                   <tbody className="divide-y divide-slate-50"> 
                     {shops.map((shop) => { 
                       const record = records.find((r) => r.shop_id === shop.id); 
                       const isPaid = !!record;
                       const isProcessing = processingId === shop.id; 
                       const pastDue = arrears[shop.name] || 0; 
                       
                       // CALCULATION LOGIC:
                       const totalObligation = shop.base_rent + pastDue; 
                       const paidAmount = record?.amount_paid || 0;
                       // Outstanding Balance = What they supposed to pay - what they paid
                       const outstandingBalance = totalObligation - paidAmount;

                       return ( 
                         <tr key={shop.id} className="hover:bg-slate-50/30 transition-colors group"> 
                           <td className="px-6 py-4 bg-white border-r border-slate-50 font-bold text-slate-700 text-sm">{shop.name}</td> 
                           <td className="px-4 py-4 bg-white border-r border-slate-50 font-mono text-xs text-slate-500">₹{formatCurrency(shop.base_rent)}</td> 
                           <td className="px-4 py-4 bg-white border-r border-slate-50 font-mono text-xs font-bold text-indigo-700">{pastDue > 0 ? formatCurrency(pastDue) : '-'}</td>
                           <td className="px-4 py-4 bg-white border-r border-slate-50 font-mono text-sm font-black text-rose-700">
                             ₹{formatCurrency(outstandingBalance)}
                           </td>
                           <td className="px-4 py-4"> 
                             <div className="flex flex-col gap-2 max-w-[200px] mx-auto"> 
                               {!isPaid ? (
                                 <button onClick={() => handleOpenPaymentModal(shop, null, outstandingBalance)} disabled={isProcessing} className="flex items-center justify-center gap-2 w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-all shadow-md"> 
                                   {isProcessing ? <Loader2 size={12} className="animate-spin"/> : <CreditCard size={12} />} Record Payment
                                 </button>
                               ) : (
                                 <div className="flex items-center gap-2">
                                   <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-lg p-2 flex flex-col items-center">
                                      <span className="text-[10px] text-emerald-600 font-bold uppercase">PAID</span>
                                      <span className="text-sm font-black text-emerald-700 font-mono">₹{formatCurrency(record?.amount_paid)}</span>
                                      <span className="text-[9px] text-slate-400 mt-0.5">{record?.collected_by}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <button onClick={() => handleOpenPaymentModal(shop, record, outstandingBalance)} className="p-1.5 bg-white border rounded hover:bg-indigo-50 hover:text-indigo-600 text-slate-400"> <Pencil size={12} /> </button>
                                      <button onClick={() => clearPayment(shop.id)} className="p-1.5 bg-white border rounded hover:bg-rose-50 hover:text-rose-600 text-slate-400"> <X size={12} /> </button>
                                    </div>
                                  </div>
                                )} 
                              </div> 
                            </td> 
                            <td className="px-4 py-4 text-right"> <div className="flex justify-end gap-2"> <button onClick={() => { setEditingShopId(shop.id); setNewShopName(shop.name); setNewShopRent(shop.base_rent.toString()); }} className="text-slate-300 hover:text-indigo-500 p-2"><Pencil size={16} /></button> <button onClick={() => deleteShop(shop.id)} className="text-slate-300 hover:text-rose-500 p-2" disabled={isProcessing}> {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} </button> </div> </td> 
                          </tr> 
                        ); 
                      })} 
                    </tbody> 
                 </table> 
               </div>

               {/* Add Shop Form */}
               <div className="p-5 bg-slate-50/50 border-t border-slate-100"> 
                   <div className="flex flex-col sm:flex-row gap-3"> <div className="w-full"> <input type="text" placeholder="Shop Name" className="w-full px-4 h-12 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm shadow-sm" value={newShopName} onChange={(e) => setNewShopName(e.target.value)} /> </div> <div className="flex gap-3 w-full sm:w-auto"> <div className="flex-grow sm:w-32"> <input type="number" placeholder="Rent" className="w-full px-4 h-12 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm shadow-sm" value={newShopRent} onChange={(e) => setNewShopRent(e.target.value)} /> </div> <button onClick={handleSaveShop} disabled={submitting} className="h-12 px-6 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-slate-200 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"> {submitting ? <Loader2 size={16} className="animate-spin" /> : (editingShopId ? <Save size={16} /> : <Plus size={16} />)} {editingShopId ? 'Update' : 'Add'} </button> {editingShopId && (<button onClick={() => { setEditingShopId(null); setNewShopName(''); setNewShopRent(''); }} className="h-12 w-12 flex items-center justify-center bg-slate-200 rounded-xl flex-shrink-0"> <X size={16} /> </button>)} </div> </div>
               </div>
            </section>

            {/* EXPENSE SECTION with Premium CSS & UX */}
            <section className="bg-white rounded-3xl shadow-xl p-6 border border-slate-100 relative overflow-hidden"> 
              {/* Background Decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -z-10 opacity-50 pointer-events-none"></div>

              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800"> 
                <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600 shadow-sm"> <CreditCard size={20} /> </div> 
                Quick Expense Record 
              </h3> 
              
              <div className="flex flex-col gap-5"> 
                
                {/* DESCRIPTION FIELD (The Magic Part) */}
                <div> 
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1.5 tracking-wider">Description</label> 
                  
                  <div className="relative group">
                    {isCustomExpense ? (
                      // 1. CUSTOM TEXT INPUT MODE
                      <div className="relative animate-in fade-in zoom-in duration-200">
                        <input 
                          type="text"
                          autoFocus
                          placeholder="Type expense description..."
                          className="w-full pl-4 pr-12 h-14 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-slate-700 font-bold text-sm transition-all shadow-sm"
                          value={newExpenseDesc}
                          onChange={(e) => setNewExpenseDesc(e.target.value)}
                          onKeyDown={(e) => {
                            if(e.key === 'Escape') setIsCustomExpense(false);
                          }}
                        />
                        <button 
                          onClick={() => setIsCustomExpense(false)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl border border-slate-100 shadow-sm transition-all"
                          title="Back to list"
                        >
                          <List size={18} />
                        </button>
                      </div>
                    ) : (
                      // 2. DROPDOWN SELECT MODE
                      <div className="relative">
                        <select 
                          className="w-full appearance-none pl-4 pr-10 h-14 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-slate-600 font-bold text-sm transition-all cursor-pointer shadow-sm hover:bg-slate-100/50" 
                          value={newExpenseDesc} 
                          onChange={(e) => {
                            if (e.target.value === 'CUSTOM_ENTRY_TRIGGER') {
                              setIsCustomExpense(true);
                              setNewExpenseDesc('');
                            } else {
                              setNewExpenseDesc(e.target.value);
                            }
                          }}
                        > 
                          <option value="">Select expense type...</option> 
                          <option value="CUSTOM_ENTRY_TRIGGER" className="font-bold text-indigo-600 bg-indigo-50">✨ Type Custom...</option>
                          <hr />
                          {PREDEFINED_EXPENSES.map(exp => (
                            <option key={exp} value={exp} className="text-slate-700 py-2">{exp}</option>
                          ))}
                        </select> 
                        {/* Custom Chevron Icon for better UI */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronRight size={18} className="rotate-90" />
                        </div>
                      </div>
                    )}
                  </div>
                </div> 

                {/* AMOUNT & PAYER ROW */}
                <div className="flex gap-4"> 
                  <div className="w-1/2"> 
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1.5 tracking-wider">Amount</label> 
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input 
                        type="number" 
                        placeholder="0" 
                        className="w-full pl-8 pr-4 h-14 rounded-2xl bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none text-slate-800 font-black text-lg transition-all shadow-sm placeholder:text-slate-300" 
                        value={newExpenseAmount} 
                        onChange={(e) => setNewExpenseAmount(e.target.value)} 
                      /> 
                    </div>
                  </div> 
                  <div className="w-1/2"> 
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1.5 tracking-wider">Paid By</label> 
                    <div className="relative">
                        <select 
                            className="w-full appearance-none pl-4 pr-10 h-14 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-slate-600 font-bold text-sm transition-all cursor-pointer shadow-sm" 
                            value={newExpensePayer} 
                            onChange={(e) => setNewExpensePayer(e.target.value)}
                        > 
                            <option value="Shared">Shared / Pool</option> 
                            {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)} 
                        </select> 
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <UserCircle size={18} />
                        </div>
                    </div>
                  </div> 
                </div> 

                {/* SUBMIT BUTTON */}
                <button 
                  onClick={addExpense} 
                  disabled={submitting || !newExpenseDesc || !newExpenseAmount} 
                  className="w-full h-14 mt-2 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm shadow-xl shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                > 
                  {submitting ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />} 
                  Record Expense 
                </button> 
              </div> 
            </section>
            
            <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden"> <div className="p-5 border-b border-slate-50 flex items-center justify-between"> <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Receipt className="text-rose-500" size={20} />Expenditures List</h2> <div className="bg-rose-50 text-rose-700 px-3 py-1 rounded-lg text-xs font-bold">Total: ₹{formatCurrency(monthlyData.totalExpenses)}</div> </div> <div className="p-5 space-y-3 custom-scrollbar"> {expenses.length === 0 ? (<p className="text-center py-8 text-slate-400 text-sm italic">No expenses recorded for this month.</p>) : (expenses.map((exp) => (<div key={exp.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm gap-3"> <div className="flex items-center gap-4"> <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center"><Receipt size={18} /></div> <div> <p className="font-bold text-slate-700 text-sm">{exp.description}</p> <p className="text-[10px] text-slate-400 uppercase tracking-wider">Paid by {exp.paid_by}</p> </div> </div> <div className="flex items-center gap-4"> <span className="font-bold text-rose-600 text-lg font-mono">-₹{formatCurrency(exp.amount)}</span> <button onClick={() => deleteExpense(exp.id)} disabled={processingId === exp.id} className="text-slate-300 hover:text-rose-500 p-2"> {processingId === exp.id ? <Loader2 size={16} className="animate-spin text-rose-500" /> : <Trash2 size={16} />} </button> </div> </div>)))} </div> </section>
          </div>

          <div className="space-y-6">
            <section className="bg-white rounded-3xl shadow-xl p-5 border border-slate-100">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><UserCircle size={20} className="text-indigo-500" />Balance Sheet</h3>
              <div className="space-y-2">
                {monthlyData.settlements.map((s, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-xs font-bold text-slate-700">{s.member}</div>
                    <div className={`text-xs font-mono font-bold ${s.balance > 0 ? 'text-rose-500' : s.balance < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {s.balance > 1 ? `Pays ₹${formatCurrency(s.balance)}` : s.balance < -1 ? `Gets ₹${formatCurrency(Math.abs(s.balance))}` : 'Settled'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <div className="bg-amber-50 p-4 rounded-3xl border border-amber-200 flex gap-3 shadow-sm"> <AlertCircle size={20} className="text-amber-500 flex-shrink-0" /> <p className="text-[10px] text-amber-800 leading-relaxed"> <strong>Shared Access:</strong> All changes made here are visible to other family members using the same Group ID. Rent is split equally (1/3) after expenses. </p> </div>

            <div className="pb-8">
              <button onClick={handleShare} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg text-base active:scale-95"> <Share2 size={20} /> <span>Share via WhatsApp</span> </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const StatCard = ({ title, value, type, icon: Icon }: any) => {
  const styles: Record<string, any> = { success: { border: "border-emerald-100", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", textColor: "text-emerald-700" }, danger: { border: "border-rose-100", iconBg: "bg-rose-50", iconColor: "text-rose-600", textColor: "text-rose-700" }, primary: { border: "border-indigo-100", iconBg: "bg-indigo-50", iconColor: "text-indigo-600", textColor: "text-indigo-700" }, warning: { border: "border-amber-100", iconBg: "bg-amber-50", iconColor: "text-amber-600", textColor: "text-amber-700" } };
  const style = styles[type];
  return (<div className={`bg-white p-4 rounded-2xl border ${style.border} shadow-sm flex flex-col justify-between min-h-[100px] transition-all hover:shadow-md`}> <div className="flex justify-between items-start mb-1"> <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p> <div className={`p-1.5 rounded-lg ${style.iconBg} ${style.iconColor}`}><Icon size={14} /></div> </div> <h3 className={`text-xl font-black tracking-tight ${style.textColor}`}>₹{formatCurrency(Math.abs(value))}</h3> </div>);
};

export default Dashboard;