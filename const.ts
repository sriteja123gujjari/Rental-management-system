export const PDF_FILE_PREFIX="Gujjari's Rent Report";
export const DASHBOARD_TITLES = {
    received: 'Received',
    expenses:'Expenses',
    balance: 'Balance',
    share:'Share (1/3)'
}

// --- MIGRATION FALLBACK DEFAULTS ---
// These are only used for auto-migrating existing users (Gujjari family)
// who already have data in the DB but no user_preferences record yet.
// New users define their own via the SetupPage wizard.

export const MEMBERS = ['Anjaneyulu', 'Srinivas', 'Goutham'];

export const DEFAULT_SHOPS_DATA = [
  { name: 'Medical Shop', baseRent: 55000 },
  { name: 'Sham Home', baseRent: 63000 },
  { name: 'Brown Bear', baseRent: 45000 },
  { name: 'Dental', baseRent: 13000 },
  { name: 'Gym', baseRent: 45000 },
  { name: 'Bhavya Clinic', baseRent: 10500 },
    { name: 'Ladies Emporium', baseRent: 13000},
    
];

export const DEFAULT_PREDEFINED_EXPENSES = [
  "House electrical",
  "Bore",
  "Worker",
  "Internet bill",
];
