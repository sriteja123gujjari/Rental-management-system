import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) { throw new Error('Missing Supabase URL or Key'); }

export const supabase = createClient(supabaseUrl, supabaseKey);

const getPreviousMonth = (currentMonth: string) => {
  const [yearStr, monthStr] = currentMonth.split('-');
  let year = parseInt(yearStr);
  let month = parseInt(monthStr) - 1;
  if (month === 0) { month = 12; year -= 1; }
  return `${year}-${String(month).padStart(2, '0')}`;
};

export const api = {
  // --- AUTHENTICATION ---
  async register(userData: { email: string; password: string; name: string; familyId: string }) {
    if (!userData.email || !userData.password || !userData.familyId) throw new Error("Missing data");
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: { data: { full_name: userData.name, family_id: userData.familyId } }
    });
    if (error) throw error;
    return data;
  },

  async login(credentials: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: credentials.email, password: credentials.password });
    if (error) throw error;
    return { ...data.user, familyId: data.user?.user_metadata?.family_id };
  },

  async logout() { await supabase.auth.signOut(); },

  // --- DATA FETCHING (FIXED GHOST SHOPS) ---
  async fetchMonthData(month: string, familyId: string) {
    // 1. Fetch Records First
    const [recordsRes, expensesRes] = await Promise.all([
      supabase.from('rent_records').select('*').eq('month', month).eq('family_id', familyId),
      supabase.from('expenses').select('*').eq('month', month).eq('family_id', familyId)
    ]);

    const rentRecords = recordsRes.data || [];
    const expenses = expensesRes.data || [];

    // 2. Fetch Shops explicitly assigned to this month
    const { data: monthlyShops } = await supabase.from('shops').select('*').eq('month', month).eq('family_id', familyId);
    
    let allShops = monthlyShops || [];

    // 3. 🛠️ FIX: Find "Ghost Shops" 
    // (Shops that have rent paid this month, but were created in a different month)
    if (rentRecords.length > 0) {
        const recordShopIds = rentRecords.map(r => r.shop_id);
        const currentShopIds = new Set(allShops.map(s => s.id));
        
        // Find IDs in records that are NOT in the current shop list
        const missingIds = recordShopIds.filter(id => !currentShopIds.has(id));
        
        if (missingIds.length > 0) {
            // Fetch these specific missing shops (ignoring month filter)
            const { data: ghostShops } = await supabase.from('shops').select('*').in('id', missingIds);
            if (ghostShops) {
                // Remove duplicates by name to prevent double showing
                const existingNames = new Set(allShops.map(s => s.name));
                const uniqueGhosts = ghostShops.filter(g => !existingNames.has(g.name));
                allShops = [...allShops, ...uniqueGhosts];
            }
        }
    }

    // Sort shops by name for consistency
    allShops.sort((a, b) => a.name.localeCompare(b.name));

    return { 
      shops: allShops, 
      rentRecords, 
      expenses 
    };
  },

  async fetchArrears(currentMonth: string, familyId: string, depth = 0): Promise<Record<string, number>> {
    if (depth > 6) return {};
    const prevMonth = getPreviousMonth(currentMonth);
    
    // We use the same "smart fetch" logic here to ensure arrears calculation sees all shops
    const { shops, rentRecords } = await this.fetchMonthData(prevMonth, familyId);
    
    if (!shops || shops.length === 0) return {};

    const prevPrevArrears = await this.fetchArrears(prevMonth, familyId, depth + 1);

    const arrearsMap: Record<string, number> = {};
    shops.forEach(shop => {
      const record = rentRecords?.find(r => r.shop_id === shop.id);
      
      // If a record is marked as settled, it clears the debt history for that shop
      if (record?.is_settled) return; 

      const paid = record ? record.amount_paid : 0;
      const debtFromPast = prevPrevArrears[shop.name] || 0;
      const due = (shop.base_rent + debtFromPast) - paid;
      if (due > 0) arrearsMap[shop.name] = due; 
    });
    return arrearsMap;
  },

  // --- SETTLEMENT ACTION ---
  async settleUp(month: string, familyId: string) {
    // Mark Rents as Settled
    await supabase.from('rent_records').update({ is_settled: true }).eq('month', month).eq('family_id', familyId).eq('is_settled', false);
    // Mark Expenses as Settled
    await supabase.from('expenses').update({ is_settled: true }).eq('month', month).eq('family_id', familyId).eq('is_settled', false);
  },

  // --- STANDARD ACTIONS ---
  async toggleRent(month: string, shopId: string, amount: number, collector: string, familyId: string) {
    const { data: existing } = await supabase.from('rent_records').select('*').eq('month', month).eq('shop_id', shopId).eq('family_id', familyId).single();

    if (amount <= 0 && existing) {
      await supabase.from('rent_records').delete().eq('id', existing.id);
    } else if (existing) {
      await supabase.from('rent_records').update({ amount_paid: amount, collected_by: collector, is_settled: false }).eq('id', existing.id);
    } else if (amount > 0) {
      await supabase.from('rent_records').insert([{ month, shop_id: shopId, amount_paid: amount, collected_by: collector, status: 'Paid', family_id: familyId, is_settled: false }]);
    }
    // Return updated list
    const { data: rentRecords } = await supabase.from('rent_records').select('*').eq('month', month).eq('family_id', familyId);
    return { rentRecords: rentRecords || [] };
  },

  async addShop(month: string, shop: { name: string; baseRent: number }, familyId: string) {
    await supabase.from('shops').insert([{ month, name: shop.name, base_rent: shop.baseRent, family_id: familyId }]);
  },

  async updateShop(month: string, id: string, updates: { name: string; baseRent: number }, familyId: string) {
    await supabase.from('shops').update({ name: updates.name, base_rent: updates.baseRent }).eq('month', month).eq('id', id).eq('family_id', familyId);
  },

  async deleteShop(month: string, id: string, familyId: string) {
    await supabase.from('rent_records').delete().eq('month', month).eq('shop_id', id).eq('family_id', familyId);
    await supabase.from('shops').delete().eq('month', month).eq('id', id).eq('family_id', familyId);
  },

  async addExpense(month: string, expense: any, familyId: string) {
    await supabase.from('expenses').insert([{ month, description: expense.description, amount: expense.amount, paid_by: expense.paidBy, family_id: familyId, is_settled: false }]);
  },

  async deleteExpense(month: string, id: string, familyId: string) {
    await supabase.from('expenses').delete().eq('month', month).eq('id', id).eq('family_id', familyId);
  }
};
