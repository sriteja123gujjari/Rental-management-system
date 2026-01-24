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

  // --- 1. AUTHENTICATION ---
  async register(userData: { email: string; password: string; name: string }) {
    // 🔍 Debugging: Log what is being received
    console.log("Registering User Data:", userData);

    // 🛡️ Safety Check: Ensure data exists before calling Supabase
    if (!userData || !userData.email || !userData.password) {
      throw new Error("Email and Password are required. Received: " + JSON.stringify(userData));
    }

    // 1. Create User in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: { full_name: userData.name, family_id: 'Gujjari' } // Meta data
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
    return { ...data.user, familyId: data.user?.user_metadata?.family_id };
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // --- 2. DASHBOARD DATA ---

  async fetchMonthData(month: string) {
    // Run 3 queries in parallel for speed
    const [shopsRes, recordsRes, expensesRes] = await Promise.all([
      supabase.from('shops').select('*').eq('month', month),
      supabase.from('rent_records').select('*').eq('month', month),
      supabase.from('expenses').select('*').eq('month', month)
    ]);

    if (shopsRes.error) throw shopsRes.error;
    if (recordsRes.error) throw recordsRes.error;
    if (expensesRes.error) throw expensesRes.error;

    return { 
      shops: shopsRes.data || [], 
      rentRecords: recordsRes.data || [], 
      expenses: expensesRes.data || [] 
    };
  },

  // --- 3. SMART ARREARS CALCULATION (Recursive) ---
  
  async fetchArrears(currentMonth: string, depth = 0): Promise<Record<string, number>> {
    // Stop if we went back 6 months to prevent infinite loading
    if (depth > 6) return {};

    const prevMonth = getPreviousMonth(currentMonth);
    
    // Get shops from previous month
    const { data: shops } = await supabase.from('shops').select('*').eq('month', prevMonth);
    
    // If no shops existed last month, there is no debt to carry over
    if (!shops || shops.length === 0) return {};

    // Get payments from previous month
    const { data: prevRecords } = await supabase.from('rent_records').select('*').eq('month', prevMonth);
    
    // RECURSION: Get debt from the month BEFORE previous
    const prevPrevArrears = await this.fetchArrears(prevMonth, depth + 1);

    const arrearsMap: Record<string, number> = {};
    
    shops.forEach(shop => {
      const record = prevRecords?.find(r => r.shop_id === shop.id);
      const paid = record ? record.amount_paid : 0;
      
      // Get debt from the past (Recursion result)
      const debtFromPast = prevPrevArrears[shop.name] || 0;

      // FORMULA: (Rent + Old Debt) - Paid Amount
      const due = (shop.base_rent + debtFromPast) - paid;
      
      // Only add to map if there is actual debt
      if (due > 0) {
        arrearsMap[shop.name] = due; 
      }
    });

    return arrearsMap;
  },

  // --- 4. ACTIONS (Rent, Shops, Expenses) ---

  async toggleRent(month: string, shopId: string, amount: number, collector: string) {
    // Check if record exists
    const { data: existing } = await supabase
      .from('rent_records')
      .select('*')
      .eq('month', month)
      .eq('shop_id', shopId)
      .single();

    if (amount <= 0 && existing) {
      // DELETE if amount is 0
      await supabase.from('rent_records').delete().eq('id', existing.id);
    } else if (existing) {
      // UPDATE if exists
      await supabase.from('rent_records').update({
        amount_paid: amount,
        collected_by: collector
      }).eq('id', existing.id);
    } else if (amount > 0) {
      // INSERT if new
      await supabase.from('rent_records').insert([{
        month,
        shop_id: shopId,
        amount_paid: amount,
        collected_by: collector,
        status: 'Paid',
        family_id: 'Gujjari'
      }]);
    }

    // Return updated records for UI refresh
    const { data: rentRecords } = await supabase.from('rent_records').select('*').eq('month', month);
    return { rentRecords: rentRecords || [] };
  },

  async addShop(month: string, shop: { name: string; baseRent: number }) {
    await supabase.from('shops').insert([{ 
        month, 
        name: shop.name, 
        base_rent: shop.baseRent, 
        family_id: 'Gujjari' 
    }]);
  },

  async updateShop(month: string, id: string, updates: { name: string; baseRent: number }) {
    await supabase.from('shops').update({ 
      name: updates.name, 
      base_rent: updates.baseRent 
    }).eq('month', month).eq('id', id);
  },

  async deleteShop(month: string, id: string) {
    // Delete related records first (Foreign Key constraint)
    await supabase.from('rent_records').delete().eq('month', month).eq('shop_id', id);
    await supabase.from('shops').delete().eq('month', month).eq('id', id);
  },

  async addExpense(month: string, expense: any) {
    await supabase.from('expenses').insert([{
      month, 
      description: expense.description, 
      amount: expense.amount, 
      paid_by: expense.paidBy, 
      family_id: 'Gujjari'
    }]);
  },

  async deleteExpense(month: string, id: string) {
    await supabase.from('expenses').delete().eq('month', month).eq('id', id);
  }
};
