import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Receipt, Wallet, Users, Download, Plus, Trash2, 
  ChevronLeft, ChevronRight, TrendingUp, CreditCard, 
  ArrowRightLeft, UserCircle, Save, AlertCircle, Pencil, X, LogOut, Share2, List, CheckCircle2
} from 'lucide-react';

// --- CAPACITOR IMPORTS (Ensure these are installed: npm install @capacitor/core @capacitor/app-launcher @capacitor/clipboard) ---
import { AppLauncher } from '@capacitor/app-launcher';
import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core'; 

import { api } from '../services/api';
import { generatePDF } from '../services/pdf';

// --- CONSTANTS ---
const MEMBERS = ['Anjaneyulu', 'Srinivas', 'Goutham'];

const MEMBER_UPI_DATA: Record<string, string> = {
  'Anjaneyulu': 'anjaneyulu@oksbi', 
  'Srinivas': 'srinivas@okaxis', 
  'Goutham': 'goutham@okicici'
};

const DEFAULT_SHOPS_DATA = [
  { name: 'Medical Shop', baseRent: 60000 },
  { name: 'Shaam Home', baseRent: 63000 },
  { name: 'Brown Bear', baseRent: 45000 },
  { name: 'Dental', baseRent: 13000 },
  { name: 'Gym', baseRent: 42000 },
  { name: 'Bhavya Clinic', baseRent: 10500 },
  { name: 'Besmile', baseRent: 10000 },
];

const PREDEFINED_EXPENSES = ["House electrical", "Bore", "Worker", "Internet bill"];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, style: 'decimal' }).format(amount);
};

const Dashboard = ({ user, onLogout }: { user: any, onLogout: () => void }) => {
  // ✅ GET FAMILY ID from User Metadata
  const familyId = user?.user_metadata?.family_id || 'Gujjari';

  // DATA STATES
  const [shops, setShops] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [arrears, setArrears] = useState<Record<string, number>>({});
  
  // UI STATES
  const [newShopName, setNewShopName] = useState('');
  const [newShopRent, setNewShopRent] = useState('');
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpensePayer, setNewExpensePayer] = useState(MEMBERS[0]); 
  const [isCustomExpense, setIsCustomExpense] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCollector, setPaymentCollector] = useState(MEMBERS[0]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false); 
  const [processingId, setProcessingId] = useState<string | null>(null); 
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- DATA FETCHING ---
  const refreshData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // ✅ Pass familyId to API
      const data = await api.fetchMonthData(currentMonth, familyId);
      setShops(data.shops || []);
      setRecords(data.rentRecords || []);
      setExpenses(data.expenses || []);
      
      // ✅ Pass familyId to Arrears
      const arrearsData = await api.fetchArrears(currentMonth, familyId);
      setArrears(arrearsData);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData(false);
  }, [currentMonth, familyId]);

  // --- CALCULATIONS ---
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
  const handleSettlePayment = async (toMember: string, amount: number) => {
    const vpa = MEMBER_UPI_DATA[toMember];
    if (!vpa) {
      alert(`UPI ID for ${toMember} is not configured.`);
      return;
    }
    await Clipboard.write({ string: vpa });
    setCopiedId(toMember);
    setTimeout(() => setCopiedId(null), 3000);
    const genericUpi = "upi://";

    if (Capacitor.isNativePlatform()) {
      try {
        await AppLauncher.openUrl({ url: genericUpi });
        alert(`UPI ID Copied: ${vpa}`);
      } catch(e) {
        alert(`UPI ID Copied: ${vpa}\n\nPlease open your payment app manually.`);
      }
    } else {
      alert(`UPI ID Copied: ${vpa}\n\nPlease pay ₹${amount} using your mobile.`);
    }
  };

  const handleOpenPaymentModal = (shop: any, currentRecord: any | null, outstandingBalance: number) => {
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
      // ✅ Pass familyId
      const res = await api.toggleRent(currentMonth, selectedShop.id, Number(paymentAmount), paymentCollector, familyId);
      setRecords(res.rentRecords);
      setPaymentModalOpen(false);
      setSelectedShop(null);
    } catch (err) {
      alert("Failed to save payment");
    } finally {
      setSubmitting(false);
    }
  };

  const clearPayment = async (shopId: string) => {
    if(!confirm("Are you sure you want to clear this payment?")) return;
    setProcessingId(shopId);
    try {
      // ✅ Pass familyId
      const res = await api.toggleRent(currentMonth, shopId, 0, MEMBERS[0], familyId); 
      setRecords(res.rentRecords);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDownloadPdf = async () => {
    await generatePDF(shops, records, expenses, currentMonth, monthlyData, 'download');
  };
  
  const handleShare = async () => {
    await generatePDF(shops, records, expenses, currentMonth, monthlyData, 'share');
  };

  const handleSeedShops = async () => { 
    setSubmitting(true); 
    for (const shopData of DEFAULT_SHOPS_DATA) { 
      const shop = { name: shopData.name, baseRent: shopData.baseRent }; 
      // ✅ Pass familyId
      await api.addShop(currentMonth, shop, familyId); 
    } 
    await refreshData(true); 
    setSubmitting(false); 
  };

  const handleSaveShop = async () => { 
    if (!newShopName || !newShopRent) return; 
    setSubmitting(true); 
    try { 
      if (editingShopId) { 
        // ✅ Pass familyId
        await api.updateShop(currentMonth, editingShopId, { name: newShopName, baseRent: Number(newShopRent) }, familyId); 
        setEditingShopId(null); 
      } else { 
        const shop = { name: newShopName, baseRent: Number(newShopRent) }; 
        // ✅ Pass familyId
        await api.addShop(currentMonth, shop, familyId); 
      } 
      setNewShopName(''); 
      setNewShopRent(''); 
      await refreshData(true); 
    } catch (err) { 
      alert("Failed to save shop."); 
    } finally { 
      setSubmitting(false); 
    } 
  };

  const deleteShop = async (id: string) => { 
    setProcessingId(id); 
    // ✅ Pass familyId
    await api.deleteShop(currentMonth, id, familyId); 
    await refreshData(true); 
    setProcessingId(null); 
  };

  const addExpense = async () => { 
    if (!newExpenseDesc || !newExpenseAmount) return; 
    setSubmitting(true); 
    try { 
      const expense = { description: newExpenseDesc, amount: Number(newExpenseAmount), paidBy: newExpensePayer }; 
      // ✅ Pass familyId
      await api.addExpense(currentMonth, expense, familyId); 
      setNewExpenseDesc(''); 
      setNewExpenseAmount(''); 
      setIsCustomExpense(false); 
      await refreshData(true); 
    } catch (err) { 
      alert("Failed to add expense."); 
    } finally { 
      setSubmitting(false); 
    } 
  };

  const deleteExpense = async (id: string) => { 
    setProcessingId(id); 
    // ✅ Pass familyId
    await api.deleteExpense(currentMonth, id, familyId); 
    await refreshData(true); 
    setProcessingId(null); 
  };

  const changeMonth = (delta: number) => { 
    const [year, month] = currentMonth.split('-').map(Number); 
    const date = new Date(Date.UTC(year, month - 1 + delta, 1)); 
    setCurrentMonth(date.toISOString().slice(0, 7)); 
  };

  // ... (Rest of UI JSX remains exactly the same, just keeping logic focused)

  // (This part is standard rendering, assumes rest of your Dashboard.tsx UI is here)
  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans pb-24 pt-8 md:pt-0 relative selection:bg-indigo-100 selection:text-indigo-900">
      {/* ... [KEEP ALL YOUR EXISTING UI JSX CODE HERE] ... */}
      {/* ... Just ensure whenever you call an api function in the UI, you are calling the wrapper functions defined above ... */}
      
      {/* HEADER Example with Dynamic Group Name */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200"> <Building2 size={22} /> </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">Rental Manager</h1>
                {/* ✅ DISPLAY THE FAMILY ID */}
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Group: {familyId}</p>
              </div>
          </div>
          {/* ... Rest of Header ... */}
          <div className="w-full md:w-auto flex justify-end gap-2">
              <button onClick={handleDownloadPdf} className="hidden md:flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md text-sm"> <Download size={18} /> <span>PDF</span> </button>
              <button onClick={onLogout} className="p-3 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all" title="Logout"> <LogOut size={20} /> </button>
          </div>
        </div>
      </header>

      {/* Main Content (Just paste your previous UI logic below this) */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-8">
         {/* ... Include Stat Cards ... */}
         
         {/* ... Include Settlement Plan ... */}

         {/* ... Include Shop Status Section ... */}
            <div className="flex justify-between items-center mb-4">
               {/* Just showing the Seed Button logic */}
               {shops.length === 0 && ( 
                 <button onClick={handleSeedShops} disabled={submitting} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 disabled:opacity-50"> 
                    {submitting ? "Loading..." : "Load Default Shops"} 
                 </button> 
               )} 
            </div>
            
            {/* ... Render Shops List ... */}

         {/* ... Include Expenses & Balance Sheet ... */}
      </main>

      {/* ... Include Payment Modal ... */}
      {paymentModalOpen && selectedShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
             {/* ... Modal Content ... */}
             <div className="bg-white p-6 rounded-2xl w-full max-w-md">
                 <h2 className="text-xl font-bold mb-4">Record Payment</h2>
                 <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full p-3 border rounded-xl mb-4" />
                 <div className="flex gap-2">
                    <button onClick={() => setPaymentModalOpen(false)} className="flex-1 p-3 bg-gray-100 rounded-xl font-bold">Cancel</button>
                    <button onClick={submitPayment} className="flex-1 p-3 bg-slate-900 text-white rounded-xl font-bold">Save</button>
                 </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
