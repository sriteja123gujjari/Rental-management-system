import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or Key in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

const getPreviousMonth = (currentMonth: string) => {
  const [yearStr, monthStr] = currentMonth.split('-');
  let year = parseInt(yearStr);
  let month = parseInt(monthStr);
  month -= 1;
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
      options: {
        data: { full_name: userData.name, family_id: userData.familyId }
      }
    });
    if (error) throw error;
    return data;
  },

  async login(credentials: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error) throw error;
    // Return user with familyId for the dashboard to use
    return { ...data.user, familyId: data.user?.user_metadata?.family_id };
  },

  async logout() {
    await supabase.auth.signOut();
  },

  // --- DATA FETCHING (Now Filtered by Family) ---

  async fetchMonthData(month: string, familyId: string) {
    const [shopsRes, recordsRes, expensesRes] = await Promise.all([
      supabase.from('shops').select('*').eq('month', month).eq('family_id', familyId),
      supabase.from('rent_records').select('*').eq('month', month).eq('family_id', familyId),
      supabase.from('expenses').select('*').eq('month', month).eq('family_id', familyId)
    ]);

    return { 
      shops: shopsRes.data || [], 
      rentRecords: recordsRes.data || [], 
      expenses: expensesRes.data || [] 
    };
  },

  async fetchArrears(currentMonth: string, familyId: string, depth = 0): Promise<Record<string, number>> {
    if (depth > 6) return {};

    const prevMonth = getPreviousMonth(currentMonth);
    
    // FILTER: Only get shops for this family
    const { data: shops } = await supabase.from('shops').select('*')
      .eq('month', prevMonth)
      .eq('family_id', familyId);
    
    if (!shops || shops.length === 0) return {};

    // FILTER: Only get records for this family
    const { data: prevRecords } = await supabase.from('rent_records').select('*')
      .eq('month', prevMonth)
      .eq('family_id', familyId);
    
    const prevPrevArrears = await this.fetchArrears(prevMonth, familyId, depth + 1);

    const arrearsMap: Record<string, number> = {};
    
    shops.forEach(shop => {
      const record = prevRecords?.find(r => r.shop_id === shop.id);
      const paid = record ? record.amount_paid : 0;
      const debtFromPast = prevPrevArrears[shop.name] || 0;
      const due = (shop.base_rent + debtFromPast) - paid;
      if (due > 0) arrearsMap[shop.name] = due; 
    });

    return arrearsMap;
  },

  // --- ACTIONS (Now Saving with Family ID) ---

  async toggleRent(month: string, shopId: string, amount: number, collector: string, familyId: string) {
    const { data: existing } = await supabase
      .from('rent_records')
      .select('*')
      .eq('month', month)
      .eq('shop_id', shopId)
      .eq('family_id', familyId) // Security check
      .single();

    if (amount <= 0 && existing) {
      await supabase.from('rent_records').delete().eq('id', existing.id);
    } else if (existing) {
      await supabase.from('rent_records').update({ amount_paid: amount, collected_by: collector }).eq('id', existing.id);
    } else if (amount > 0) {
      await supabase.from('rent_records').insert([{
        month,
        shop_id: shopId,
        amount_paid: amount,
        collected_by: collector,
        status: 'Paid',
        family_id: familyId // ✅ SAVE FAMILY ID
      }]);
    }
    
    // Return updated list
    const { data: rentRecords } = await supabase.from('rent_records').select('*').eq('month', month).eq('family_id', familyId);
    return { rentRecords: rentRecords || [] };
  },

  async addShop(month: string, shop: { name: string; baseRent: number }, familyId: string) {
    await supabase.from('shops').insert([{ 
        month, 
        name: shop.name, 
        base_rent: shop.baseRent, 
        family_id: familyId // ✅ SAVE FAMILY ID
    }]);
  },

  async updateShop(month: string, id: string, updates: { name: string; baseRent: number }, familyId: string) {
    await supabase.from('shops').update({ name: updates.name, base_rent: updates.baseRent })
      .eq('month', month).eq('id', id).eq('family_id', familyId);
  },

  async deleteShop(month: string, id: string, familyId: string) {
    await supabase.from('rent_records').delete().eq('month', month).eq('shop_id', id).eq('family_id', familyId);
    await supabase.from('shops').delete().eq('month', month).eq('id', id).eq('family_id', familyId);
  },

  async addExpense(month: string, expense: any, familyId: string) {
    await supabase.from('expenses').insert([{
      month, description: expense.description, amount: expense.amount, paid_by: expense.paidBy, family_id: familyId 
    }]);
  },

  async deleteExpense(month: string, id: string, familyId: string) {
    await supabase.from('expenses').delete().eq('month', month).eq('id', id).eq('family_id', familyId);
  }
};
