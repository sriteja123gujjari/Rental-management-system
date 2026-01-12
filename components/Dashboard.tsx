
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Receipt, 
  Wallet, 
  Users, 
  Download, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  CreditCard,
  Loader2,
  IndianRupee,
  ArrowRightLeft,
  UserCircle,
  Save,
  AlertCircle,
  Pencil,
  X,
  LogOut
} from 'lucide-react';
import { api } from '../services/api';
import { generatePDF } from '../services/pdf';

const MEMBERS = ['Anjaneyulu', 'Srinivas', 'Goutham'];

const DEFAULT_SHOPS_DATA = [
  { name: 'Medical Shop', baseRent: 55000 },
  { name: 'Sham Home', baseRent: 63000 },
  { name: 'Brown Bear', baseRent: 45000 },
  { name: 'Dental', baseRent: 13000 },
  { name: 'Gym', baseRent: 45000 },
  { name: 'Bhavya Clinic', baseRent: 10500 },
];

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

  const refreshData = async () => {
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
    setLoading(true);
    refreshData();
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
    const debtors = settlements.filter(s => s.balance > 0.01).sort((a, b) => b.balance - a.balance);
    const creditors = settlements.filter(s => s.balance < -0.01).sort((a, b) => a.balance - b.balance);
    
    let dIndex = 0;
    let cIndex = 0;
    const activeDebtors = debtors.map(d => ({...d}));
    const activeCreditors = creditors.map(c => ({...c}));

    while (dIndex < activeDebtors.length && cIndex < activeCreditors.length) {
      const debtor = activeDebtors[dIndex];
      const creditor = activeCreditors[cIndex];
      const amount = Math.min(debtor.balance, Math.abs(creditor.balance));
      if (amount > 0) {
        transactions.push({ from: debtor.member, to: creditor.member, amount });
      }
      debtor.balance -= amount;
      creditor.balance += amount;
      if (debtor.balance < 0.01) dIndex++;
      if (Math.abs(creditor.balance) < 0.01) cIndex++;
    }

    return { received, totalExpenses, net, split, settlements, transactions };
  }, [records, expenses]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleSeedShops = async () => {
    setLoading(true);
    for (const shopData of DEFAULT_SHOPS_DATA) {
      const shop = { id: generateId(), name: shopData.name, baseRent: shopData.baseRent };
      await api.addShop(currentMonth, shop);
    }
    await refreshData();
  };

  const handleSaveShop = async () => {
    if (!newShopName || !newShopRent) return;
    if (editingShopId) {
      await api.updateShop(currentMonth, editingShopId, { name: newShopName, baseRent: Number(newShopRent) });
      setEditingShopId(null);
    } else {
      const shop = { id: generateId(), name: newShopName, baseRent: Number(newShopRent) };
      await api.addShop(currentMonth, shop);
    }
    setNewShopName('');
    setNewShopRent('');
    refreshData();
  };

  const deleteShop = async (id: string) => {
    if(window.confirm("Delete shop?")) {
      await api.deleteShop(currentMonth, id);
      refreshData();
    }
  };

  const toggleRentStatus = async (shopId: string, baseRent: number) => {
    const res = await api.toggleRent(currentMonth, shopId, baseRent, MEMBERS[0]);
    setRecords(res.rentRecords);
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
    const expense = {
      id: generateId(),
      description: newExpenseDesc,
      amount: Number(newExpenseAmount),
      paidBy: newExpensePayer,
      timestamp: new Date().toISOString()
    };
    await api.addExpense(currentMonth, expense);
    setNewExpenseDesc('');
    setNewExpenseAmount('');
    refreshData();
  };

  const deleteExpense = async (id: string) => {
    await api.deleteExpense(currentMonth, id);
    refreshData();
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
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans pb-12">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:h-20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-200">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Gujjari's Rental</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Group: {user.familyId}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
            <div className="flex items-center bg-white rounded-xl p-1 border shadow-sm ring-1 ring-slate-100">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-50 rounded-lg transition-colors active:scale-95 text-slate-500">
                <ChevronLeft size={20} />
              </button>
              <div className="px-4 text-center border-x border-slate-100">
                 <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Period</span>
                 <span className="font-bold text-slate-800 text-sm whitespace-nowrap">
                   {new Date(currentMonth + '-01').toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                 </span>
              </div>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-50 rounded-lg transition-colors active:scale-95 text-slate-500">
                <ChevronRight size={20} />
              </button>
            </div>
            
            {/* PDF Export moved to header */}
            <button 
              onClick={() => generatePDF(shops, records, expenses, currentMonth, monthlyData)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md text-xs active:scale-95 whitespace-nowrap"
              title="Export PDF Report"
            >
              <Download size={16} /> <span className="hidden sm:inline">Export PDF</span>
            </button>

            <button 
              onClick={onLogout}
              className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard title="Received" value={monthlyData.received} type="success" icon={TrendingUp} />
          <StatCard title="Expenses" value={monthlyData.totalExpenses} type="danger" icon={Receipt} />
          <StatCard title="Net Profit" value={monthlyData.net} type="primary" icon={Wallet} />
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
                                <div className="bg-rose-500/20 text-rose-300 p-1.5 rounded-lg font-bold text-xs uppercase text-center sm:w-24">{t.from}</div>
                                <span className="text-white/50 text-xs">pays</span>
                                <div className="bg-emerald-500/20 text-emerald-300 p-1.5 rounded-lg font-bold text-xs uppercase text-center sm:w-24">{t.to}</div>
                            </div>
                            <div className="font-bold text-lg font-mono">₹{t.amount.toLocaleString()}</div>
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
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                  >
                    <Plus size={14} /> Load Default Shops
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
                      return (
                        <tr key={shop.id} className="hover:bg-slate-50/30 transition-colors group">
                          {/* Strict white background for Shop Name and Rent columns */}
                          <td className="px-6 py-4 bg-white border-r border-slate-50"><span className="font-bold text-slate-700 block text-sm">{shop.name}</span></td>
                          <td className="px-4 py-4 bg-white border-r border-slate-50"><div className="font-bold text-indigo-700 font-mono bg-white w-fit px-2 py-1 rounded text-xs border border-indigo-100">₹{shop.baseRent.toLocaleString()}</div></td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-2 max-w-[180px] mx-auto">
                              <button 
                                  onClick={() => toggleRentStatus(shop.id, shop.baseRent)}
                                  className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all border w-full justify-center ${
                                      isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm' : 'bg-white text-slate-400 border-slate-200'
                                  }`}
                              >
                                  {isPaid ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 rounded-full border-2 border-slate-200"></div>}
                                  {isPaid ? `PAID` : 'MARK PAID'}
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
                                <button onClick={() => deleteShop(shop.id)} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-5 bg-slate-50/50 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <input type="text" placeholder="Shop Name" className="flex-grow p-3 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-sm" value={newShopName} onChange={(e) => setNewShopName(e.target.value)} />
                  <input type="number" placeholder="Rent" className="w-full sm:w-32 p-3 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-sm" value={newShopRent} onChange={(e) => setNewShopRent(e.target.value)} />
                  <button onClick={handleSaveShop} className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-slate-200">
                    {editingShopId ? <Save size={16} /> : <Plus size={16} />} {editingShopId ? 'Update' : 'Add'}
                  </button>
                  {editingShopId && <button onClick={() => { setEditingShopId(null); setNewShopName(''); setNewShopRent(''); }} className="p-3 bg-slate-200 rounded-xl"><X size={16}/></button>}
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
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 block mb-1">Description</label>
                  <input type="text" placeholder="e.g. Electric Bill" className="w-full p-3 rounded-xl bg-slate-50 ring-1 ring-slate-100 focus:ring-2 focus:ring-rose-500 outline-none text-sm shadow-sm" value={newExpenseDesc} onChange={(e) => setNewExpenseDesc(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 block mb-1">Amount</label>
                  <input type="number" placeholder="0.00" className="w-full p-3 rounded-xl bg-slate-50 ring-1 ring-slate-100 focus:ring-2 focus:ring-rose-500 outline-none text-sm shadow-sm" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 block mb-1">Paid By</label>
                  <select className="w-full p-3 rounded-xl bg-slate-50 ring-1 ring-slate-100 outline-none text-sm shadow-sm font-bold" value={newExpensePayer} onChange={(e) => setNewExpensePayer(e.target.value)}>
                      <option value="Shared">Shared / Pool</option>
                      {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-4 mt-2">
                  <button onClick={addExpense} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 text-sm shadow-lg"><Plus size={16} />Record Expense</button>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Receipt className="text-rose-500" size={20} />Expenditures List</h2>
                <div className="bg-rose-50 text-rose-700 px-3 py-1 rounded-lg text-xs font-bold">Total: ₹{monthlyData.totalExpenses.toLocaleString()}</div>
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
                        <span className="font-bold text-rose-600 text-lg font-mono">-₹{exp.amount.toLocaleString()}</span>
                        <button onClick={() => deleteExpense(exp.id)} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 size={16} /></button>
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
                                 {s.balance > 0 ? `Pays ₹${s.balance.toFixed(0)}` : s.balance < 0 ? `Gets ₹${Math.abs(s.balance).toFixed(0)}` : 'Settled'}
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
      <h3 className={`text-xl font-black tracking-tight ${style.textColor}`}>₹{Math.abs(value).toLocaleString()}</h3>
    </div>
  );
};

export default Dashboard;
