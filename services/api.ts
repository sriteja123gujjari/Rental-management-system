import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- FIX: MATH BASED MONTH CALCULATION (No Timezone bugs) ---
const getPreviousMonth = (currentMonth: string) => {
  const [yearStr, monthStr] = currentMonth.split('-');
  let year = parseInt(yearStr);
  let month = parseInt(monthStr);

  // Subtract 1 month
  month -= 1;

  // Handle year rollback (e.g. Jan 2025 -> Dec 2024)
  if (month === 0) {
    month = 12;
    year -= 1;
  }

  // Return formatted string "YYYY-MM"
  return `${year}-${String(month).padStart(2, '0')}`;
};

export const api = {
  // 1. FETCH DATA
  async fetchMonthData(month: string) {
    const { data: shops } = await supabase.from('shops').select('*').eq('month', month);
    const { data: rentRecords } = await supabase.from('rent_records').select('*').eq('month', month);
    const { data: expenses } = await supabase.from('expenses').select('*').eq('month', month);
    return { shops, rentRecords, expenses };
  },

  // 2. FETCH ARREARS (Recursive to carry over past debt)
  async fetchArrears(currentMonth: string, depth = 0): Promise<Record<string, number>> {
    // Safety stop after 6 months to prevent infinite loops
    if (depth > 6) return {};

    const prevMonth = getPreviousMonth(currentMonth);
    
    // 1. Get shops from previous month
    const { data: shops } = await supabase.from('shops').select('*').eq('month', prevMonth);
    
    // If no shops existed last month, there's no debt to calculate
    if (!shops || shops.length === 0) return {};

    // 2. Get payments from previous month
    const { data: prevRecords } = await supabase.from('rent_records').select('*').eq('month', prevMonth);
    
    // 3. RECURSION: Get debt from the month BEFORE previous
    const prevPrevArrears = await this.fetchArrears(prevMonth, depth + 1);

    const arrearsMap: Record<string, number> = {};
    
    shops.forEach(shop => {
      const record = prevRecords?.find(r => r.shop_id === shop.id);
      const paid = record ? record.amount_paid : 0;
      
      // Get debt from the past (e.g. from 2 months ago)
      const debtFromPast = prevPrevArrears[shop.name] || 0;

      // FORMULA: (Rent + Old Debt) - Paid Amount
      const due = (shop.base_rent + debtFromPast) - paid;
      
      // If due is positive, they owe money. 
      if (due > 0) {
        arrearsMap[shop.name] = due; 
      }
    });

    return arrearsMap;
  },

  // 3. SAVE PAYMENT
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

  // 4. ADD SHOP
  async addShop(month: string, shop: { name: string; baseRent: number }) {
    await supabase.from('shops').insert([{ 
        month, name: shop.name, base_rent: shop.baseRent, family_id: 'Gujjari' 
    }]);
  },

  // 5. UPDATE SHOP
  async updateShop(month: string, id: string, updates: { name: string; baseRent: number }) {
    await supabase.from('shops').update({ name: updates.name, base_rent: updates.baseRent })
      .eq('month', month).eq('id', id);
  },

  // 6. DELETE SHOP
  async deleteShop(month: string, id: string) {
    await supabase.from('rent_records').delete().eq('month', month).eq('shop_id', id);
    await supabase.from('shops').delete().eq('month', month).eq('id', id);
  },

  // 7. UPDATE COLLECTOR
  async updateRentRecord(month: string, shopId: string, updates: any) {
    await supabase.from('rent_records').update({ collected_by: updates.collectedBy })
      .eq('month', month).eq('shop_id', shopId);
    const { data: rentRecords } = await supabase.from('rent_records').select('*').eq('month', month);
    return { rentRecords };
  },

  // 8. EXPENSES
  async addExpense(month: string, expense: any) {
    await supabase.from('expenses').insert([{
      month, description: expense.description, amount: expense.amount, paid_by: expense.paidBy, family_id: 'Gujjari'
    }]);
  },

  async deleteExpense(month: string, id: string) {
    await supabase.from('expenses').delete().eq('month', month).eq('id', id);
  }
};