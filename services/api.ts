import { createClient } from '@supabase/supabase-js';

// 1. Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or Key in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- HELPER: Math-based Month Calculation (No Timezone bugs) ---
const getPreviousMonth = (currentMonth: string) => {
  const [yearStr, monthStr] = currentMonth.split('-');
  let year = parseInt(yearStr);
  let month = parseInt(monthStr);

  month -= 1;

  if (month === 0) {
    month = 12;
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
};

export const api = {

  // ==========================================
  //  1. AUTHENTICATION (THIS WAS MISSING)
  // ==========================================

  // Register New User
  async register(userData: { email: string; password: string; name: string }) {
    console.log("API: Registering...", userData); 

    if (!userData.email || !userData.password) {
      throw new Error("Email and Password are required.");
    }

    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: { full_name: userData.name, family_id: 'Gujjari' } // Store name in metadata
      }
    });

    if (error) throw error;
    return data;
  },

  // Login Existing User
  async login(credentials: { email: string; password: string }) {
    console.log("API: Logging in...", credentials);

    if (!credentials.email || !credentials.password) {
        throw new Error("Email and Password are required.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) throw error;
    
    // Return user data along with the custom familyId from metadata
    return { ...data.user, familyId: data.user?.user_metadata?.family_id };
  },

  // Logout
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // ==========================================
  //  2. DATA FETCHING
  // ==========================================

  async fetchMonthData(month: string) {
    const { data: shops } = await supabase.from('shops').select('*').eq('month', month);
    const { data: rentRecords } = await supabase.from('rent_records').select('*').eq('month', month);
    const { data: expenses } = await supabase.from('expenses').select('*').eq('month', month);
    return { shops, rentRecords, expenses };
  },

  // ... (Your existing fetchArrears logic is fine, keeping it here) ...
  async fetchArrears(currentMonth: string, depth = 0): Promise<Record<string, number>> {
    if (depth > 6) return {};

    const prevMonth = getPreviousMonth(currentMonth);
    const { data: shops } = await supabase.from('shops').select('*').eq('month', prevMonth);
    
    if (!shops || shops.length === 0) return {};

    const { data: prevRecords } = await supabase.from('rent_records').select('*').eq('month', prevMonth);
    const prevPrevArrears = await this.fetchArrears(prevMonth, depth + 1);

    const arrearsMap: Record<string, number> = {};
    
    shops.forEach(shop => {
      const record = prevRecords?.find(r => r.shop_id === shop.id);
      const paid = record ? record.amount_paid : 0;
      const debtFromPast = prevPrevArrears[shop.name] || 0;
      const due = (shop.base_rent + debtFromPast) - paid;
      
      if (due > 0) {
        arrearsMap[shop.name] = due; 
      }
    });

    return arrearsMap;
  },

  // ==========================================
  //  3. ACTIONS
  // ==========================================

  async toggleRent(month: string, shopId: string, amount: number, collector: string) {
    const { data: existing } = await supabase
      .from('rent_records')
      .select('*')
      .eq('month', month)
      .eq('shop_id', shopId)
      .single();

    if (amount <= 0 && existing) {
      await supabase.from('rent_records').delete().eq('id', existing.id);
    } else if (existing) {
      await supabase.from('rent_records').update({
        amount_paid: amount,
        collected_by: collector
      }).eq('id', existing.id);
    } else if (amount > 0) {
      await supabase.from('rent_records').insert([{
        month,
        shop_id: shopId,
        amount_paid: amount,
        collected_by: collector,
        status: 'Paid',
        family_id: 'Gujjari'
      }]);
    }

    const { data: rentRecords } = await supabase.from('rent_records').select('*').eq('month', month);
    return { rentRecords };
  },

  async addShop(month: string, shop: { name: string; baseRent: number }) {
    await supabase.from('shops').insert([{ 
        month, name: shop.name, base_rent: shop.baseRent, family_id: 'Gujjari' 
    }]);
  },

  async updateShop(month: string, id: string, updates: { name: string; baseRent: number }) {
    await supabase.from('shops').update({ name: updates.name, base_rent: updates.baseRent })
      .eq('month', month).eq('id', id);
  },

  async deleteShop(month: string, id: string) {
    await supabase.from('rent_records').delete().eq('month', month).eq('shop_id', id);
    await supabase.from('shops').delete().eq('month', month).eq('id', id);
  },

  async updateRentRecord(month: string, shopId: string, updates: any) {
    await supabase.from('rent_records').update({ collected_by: updates.collectedBy })
      .eq('month', month).eq('shop_id', shopId);
    const { data: rentRecords } = await supabase.from('rent_records').select('*').eq('month', month);
    return { rentRecords };
  },

  async addExpense(month: string, expense: any) {
    await supabase.from('expenses').insert([{
      month, description: expense.description, amount: expense.amount, paid_by: expense.paidBy, family_id: 'Gujjari'
    }]);
  },

  async deleteExpense(month: string, id: string) {
    await supabase.from('expenses').delete().eq('month', month).eq('id', id);
  }
};
