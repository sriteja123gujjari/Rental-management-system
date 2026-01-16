import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Receipt, Wallet, Users, Download, Plus, Trash2, 
  CheckCircle2, ChevronLeft, ChevronRight, TrendingUp, CreditCard, 
  Loader2, ArrowRightLeft, UserCircle, Save, AlertCircle, Pencil, X, LogOut, Check, Share2, FileText
} from 'lucide-react';
import { api } from '../services/api';
import { generatePDF } from '../services/pdf';
import {MEMBERS, DEFAULT_SHOPS_DATA} from '../const'

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    style: 'decimal',
  }).format(amount);
};




const Dashboard = ({ user, onLogout }) => {
  const [shops, setShops] = useState([]);
  const [records, setRecords] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [newShopName, setNewShopName] = useState('');
  const [newShopRent, setNewShopRent] = useState('');
  const [editingShopId, setEditingShopId] = useState(null);

  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpensePayer, setNewExpensePayer] = useState('Shared');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false); 
  const [processingId, setProcessingId] = useState(null); 
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  const refreshData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.fetchMonthData(currentMonth);
      setShops(data.shops || []);
      setRecords(data.rentRecords || []);
      setExpenses(data.expenses || []);
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
      .filter((r: any) => r.status === 'Paid')
      .reduce((sum, r: any) => sum + Number(r.amountPaid || 0), 0);
    
    const totalExpenses = expenses.reduce((sum, e: any) => sum + Number(e.amount || 0), 0);
    const net = received - totalExpenses;
    const split = net / 3;

    const memberBalances: Record<string, number> = {};
    MEMBERS.forEach(m => memberBalances[m] = 0);

    records.forEach((r: any) => {
      if (r.status === 'Paid' && r.collectedBy && MEMBERS.includes(r.collectedBy)) {
        memberBalances[r.collectedBy] += Number(r.amountPaid || 0);
      }
    });

    expenses.forEach((e: any) => {
      if (e.paidBy && MEMBERS.includes(e.paidBy)) {
        memberBalances[e.paidBy] -= Number(e.amount || 0);
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

  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    setPdfSuccess(false);
    try {
        await new Promise(resolve => setTimeout(resolve, 500));
        generatePDF(shops, records, expenses, currentMonth, monthlyData, false);
        setPdfSuccess(true);
        setTimeout(() => setPdfSuccess(false), 3000);
    } catch (error) {
        console.error("PDF Error", error);
        alert("Failed to generate PDF");
    } finally {
        setDownloadingPdf(false);
    }
  };

  const handleSharePDF = async () => {
    setSharingPdf(true);
    try {
      const pdfBlob = generatePDF(shops, records, expenses, currentMonth, monthlyData, true);
      if (!pdfBlob) throw new Error("PDF generation failed");

      const file = new File([pdfBlob], `Rent_Report_${currentMonth}.pdf`, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Monthly Rent Report',
          text: `Rent Report for ${currentMonth}`,
        });
      } else {
        alert("Sharing not supported on this device. Downloading instead.");
        generatePDF(shops, records, expenses, currentMonth, monthlyData, false);
      }
    } catch (error) {
      console.error("Share Error", error);
    } finally {
      setSharingPdf(false);
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

  const toggleRentStatus = async (shopId: string, baseRent: number) => {
    setProcessingId(shopId);
    try {
        const res = await api.toggleRent(currentMonth, shopId, baseRent, MEMBERS[0]);
        setRecords(res.rentRecords);
    } catch(err) {
        console.error("Toggle rent failed", err);
    } finally {
        setProcessingId(null);
    }
  };

  const updateCollectedBy = async (shopId: string, newCollector: string) => {
    try {
      const res = await api.updateRentRecord(currentMonth, shopId, { collectedBy: newCollector });
      setRecords(res.rentRecords);
    } catch (err) {
      console.error("Update collector failed", err);
    }
  };

  const addExpense = async () => {
    if (!newExpenseDesc || !newExpenseAmount) return;
    setSubmitting(true);
    try {
        const expense = {
          description: newExpenseDesc,
          amount: Number(newExpenseAmount),
          paidBy: newExpensePayer
        };
        await api.addExpense(currentMonth, expense);
        setNewExpenseDesc('');
        setNewExpenseAmount('');
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
      <p className="text-gray-500 font-medium">Fetching Family Data...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans pb-12 relative">
      {pdfSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white px-8 py-6 rounded-3xl shadow-2xl border border-emerald-100 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300 pointer-events-auto">
            <div className="bg-emerald-100 p-4 rounded-full text-emerald-600 shadow-sm">
               <CheckCircle2 size={40} strokeWidth={3} />
            </div>
            <span className="text-emerald-800 font-bold text-xl tracking-tight">Successfully downloaded!</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:h-24 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-200">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">Gujjari's Rental</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Group: {user.familyId}</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center bg-white rounded-xl p-1 border shadow-sm ring-1 ring-slate-100 w-full sm:w-auto justify-between sm:justify-center">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-50 rounded-lg transition-colors active:scale-95 text-slate-500">
                <ChevronLeft size={20} />
              </button>
              <div className="px-4 text-center border-x border-slate-100 flex-grow sm:flex-grow-0">
                 <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Period</span>
                 <span className="font-bold text-slate-800 text-sm whitespace-nowrap">
                   {new Date(currentMonth + '-01').toLocaleDateString('default', { month: 'short', year: 'numeric' })}
                 </span>
              </div>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-50 rounded-lg transition-colors active:scale-95 text-slate-500">
                <ChevronRight size={20} />
              </button>
            </div>
            
            <div className="flex w-full sm:w-auto gap-2">
                {/* ✅ DOWNLOAD BUTTON - BACK AT TOP */}
                <button 
                  onClick={handleDownloadPDF}
                  disabled={downloadingPdf}
                  className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md text-sm active:scale-95 whitespace-nowrap disabled:opacity-70 disabled:cursor-wait"
                >
                  {downloadingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} 
                  <span className="">{downloadingPdf ? "Generating..." : "PDF"}</span>
                </button>

                <button 
                  onClick={onLogout}
                  className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard title="Received" value={monthlyData.received} type="success" icon={TrendingUp} />
          <StatCard title="Expenses" value={monthlyData.totalExpenses} type="danger" icon={Receipt} />
          <StatCard title="Balance" value={monthlyData.net} type="primary" icon={Wallet} />
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

            <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Building2 className="text-indigo-500" size={20} />Shop Status</h2>
                {shops.length === 0 && (
                  <button 
                    onClick={handleSeedShops}
                    disabled={submitting}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14} />} Load Default Shops
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="px-6 py-4">Shop Details</th>
                      <th className="px-4 py-4">Rent Amount</th>
                      <th className="px-4 py-4 text-center">Status & Collector</th>
                      <th className="px-4 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {shops.map((shop: any) => {
                      const record: any = records.find((r: any) => r.shopId === shop.id);
                      const isPaid = record?.status === 'Paid';
                      const isProcessing = processingId === shop.id;

                      return (
                        <tr key={shop.id} className="hover:bg-slate-50/30 transition-colors group">
                          <td className="px-6 py-4 bg-white border-r border-slate-50"><span className="font-bold text-slate-700 block text-sm">{shop.name}</span></td>
                          <td className="px-4 py-4 bg-white border-r border-slate-50"><div className="font-bold text-indigo-700 font-mono bg-white w-fit px-2 py-1 rounded text-xs border border-indigo-100">₹{formatCurrency(shop.baseRent || 0)}</div></td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-2 max-w-[180px] mx-auto">
                              <button 
                                  onClick={() => toggleRentStatus(shop.id, shop.baseRent)}
                                  disabled={isProcessing}
                                  className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all border w-full justify-center ${
                                    isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm' : 'bg-white text-slate-400 border-slate-200'
                                  }`}
                              >
                                  {isProcessing ? <Loader2 size={12} className="animate-spin text-slate-400"/> : (
                                    <>
                                      {isPaid ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 rounded-full border-2 border-slate-200"></div>}
                                      {isPaid ? `PAID` : 'MARK PAID'}
                                    </>
                                  )}
                              </button>
                              
                              {isPaid && (
                                <select 
                                  className="text-[10px] p-1.5 border rounded-lg bg-white text-slate-600 font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                                  value={record.collectedBy || MEMBERS[0]}
                                  onChange={(e) => updateCollectedBy(shop.id, e.target.value)}
                                >
                                  {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex justify-end gap-2">
                                <button onClick={() => { setEditingShopId(shop.id); setNewShopName(shop.name); setNewShopRent(shop.baseRent.toString()); }} className="text-slate-300 hover:text-indigo-500 p-2"><Pencil size={16} /></button>
                                <button onClick={() => deleteShop(shop.id)} className="text-slate-300 hover:text-rose-500 p-2" disabled={isProcessing}>
                                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="p-5 bg-slate-50/50 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="w-full">
                      <input 
                        type="text" 
                        placeholder="Shop Name" 
                        className="w-full px-4 h-12 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm shadow-sm" 
                        value={newShopName} 
                        onChange={(e) => setNewShopName(e.target.value)} 
                      />
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                      <div className="flex-grow sm:w-32">
                          <input 
                            type="number" 
                            placeholder="Rent" 
                            className="w-full px-4 h-12 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm shadow-sm" 
                            value={newShopRent} 
                            onChange={(e) => setNewShopRent(e.target.value)} 
                          />
                      </div>
                      <button 
                        onClick={handleSaveShop} 
                        disabled={submitting} 
                        className="h-12 px-6 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-slate-200 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : (editingShopId ? <Save size={16} /> : <Plus size={16} />)} 
                        {editingShopId ? 'Update' : 'Add'}
                      </button>
                      {editingShopId && (
                        <button onClick={() => { setEditingShopId(null); setNewShopName(''); setNewShopRent(''); }} className="h-12 w-12 flex items-center justify-center bg-slate-200 rounded-xl flex-shrink-0">
                            <X size={16}/>
                        </button>
                      )}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-3xl shadow-xl p-6 border border-slate-100">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800">
                <div className="p-1.5 bg-rose-100 rounded-lg text-rose-600">
                   <CreditCard size={20} />
                </div>
                Quick Expense Record
              </h3>
              
              <div className="flex flex-col gap-4">
                 <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 block mb-1">Description</label>
                    <input type="text" placeholder="e.g. Electric Bill" className="w-full px-4 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-100 focus:ring-2 focus:ring-rose-500 outline-none text-base sm:text-sm shadow-sm" value={newExpenseDesc} onChange={(e) => setNewExpenseDesc(e.target.value)} />
                 </div>
                 
                 <div className="flex gap-3">
                    <div className="w-1/2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 block mb-1">Amount</label>
                      <input type="number" placeholder="0.00" className="w-full px-4 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-100 focus:ring-2 focus:ring-rose-500 outline-none text-base sm:text-sm shadow-sm" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)} />
                    </div>
                    <div className="w-1/2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 block mb-1">Paid By</label>
                      <select className="w-full px-2 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-100 outline-none text-sm shadow-sm font-bold" value={newExpensePayer} onChange={(e) => setNewExpensePayer(e.target.value)}>
                          <option value="Shared">Shared / Pool</option>
                          {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                 </div>

                 <button onClick={addExpense} disabled={submitting} className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 text-sm shadow-lg disabled:opacity-70 disabled:cursor-not-allowed">
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Record Expense
                 </button>
              </div>
            </section>

            <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Receipt className="text-rose-500" size={20} />Expenditures List</h2>
                <div className="bg-rose-50 text-rose-700 px-3 py-1 rounded-lg text-xs font-bold">Total: ₹{formatCurrency(monthlyData.totalExpenses)}</div>
              </div>
              <div className="p-5 space-y-3 custom-scrollbar">
                {expenses.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 text-sm italic">No expenses recorded for this month.</p>
                ) : (
                  expenses.map((exp: any) => (
                    <div key={exp.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm gap-3">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center"><Receipt size={18} /></div>
                        <div>
                          <p className="font-bold text-slate-700 text-sm">{exp.description}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Paid by {exp.paidBy}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-rose-600 text-lg font-mono">-₹{formatCurrency(exp.amount)}</span>
                        <button onClick={() => deleteExpense(exp.id)} disabled={processingId === exp.id} className="text-slate-300 hover:text-rose-500 p-2">
                            {processingId === exp.id ? <Loader2 size={16} className="animate-spin text-rose-500" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
             <section className="bg-white rounded-3xl shadow-xl p-5 border border-slate-100">
                 <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><UserCircle size={20} className="text-indigo-500" />Balance Sheet</h3>
                 <div className="space-y-2">
                     {monthlyData.settlements.map((s: any, idx) => (
                         <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                             <div className="text-xs font-bold text-slate-700">{s.member}</div>
                             <div className={`text-xs font-mono font-bold ${s.balance > 0 ? 'text-rose-500' : s.balance < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                 {s.balance > 1 ? `Pays ₹${formatCurrency(s.balance)}` : s.balance < -1 ? `Gets ₹${formatCurrency(Math.abs(s.balance))}` : 'Settled'}
                             </div>
                         </div>
                     ))}
                 </div>
             </section>

             <div className="bg-amber-50 p-4 rounded-3xl border border-amber-200 flex gap-3 shadow-sm">
               <AlertCircle size={20} className="text-amber-500 flex-shrink-0" />
               <p className="text-[10px] text-amber-800 leading-relaxed">
                 <strong>Shared Access:</strong> All changes made here are visible to other family members using the same Group ID. Rent is split equally (1/3) after expenses.
               </p>
             </div>

             {/* ✅ SHARE BUTTON ONLY AT BOTTOM */}
             <div className="pb-8">
                <button 
                  onClick={handleSharePDF}
                  disabled={sharingPdf}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg text-base active:scale-95 disabled:opacity-70 disabled:cursor-wait"
                >
                  {sharingPdf ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20} />}
                  <span>Share via WhatsApp</span>
                </button>
             </div>

          </div>
        </div>
      </main>
    </div>
  );
};

const StatCard = ({ title, value, type, icon: Icon }: any) => {
  const styles: Record<string, any> = {
    success: { border: "border-emerald-100", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", textColor: "text-emerald-700" },
    danger: { border: "border-rose-100", iconBg: "bg-rose-50", iconColor: "text-rose-600", textColor: "text-rose-700" },
    primary: { border: "border-indigo-100", iconBg: "bg-indigo-50", iconColor: "text-indigo-600", textColor: "text-indigo-700" },
    warning: { border: "border-amber-100", iconBg: "bg-amber-50", iconColor: "text-amber-600", textColor: "text-amber-700" }
  };
  const style = styles[type];
  return (
    <div className={`bg-white p-4 rounded-2xl border ${style.border} shadow-sm flex flex-col justify-between min-h-[100px] transition-all hover:shadow-md`}>
      <div className="flex justify-between items-start mb-1">
         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
         <div className={`p-1.5 rounded-lg ${style.iconBg} ${style.iconColor}`}><Icon size={14} /></div>
      </div>
      <h3 className={`text-xl font-black tracking-tight ${style.textColor}`}>₹{formatCurrency(Math.abs(value))}</h3>
    </div>
  );
};

export default Dashboard;
