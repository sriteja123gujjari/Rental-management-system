
const mongoose = require('mongoose');

const MonthlyDataSchema = new mongoose.Schema({
  familyId: { type: String, required: true },
  month: { type: String, required: true }, // YYYY-MM
  shops: [{
    id: String, // Internal UI ID for mapping
    name: String,
    baseRent: Number
  }],
  rentRecords: [{
    shopId: String,
    status: { type: String, enum: ['Paid', 'Unpaid'], default: 'Unpaid' },
    amountPaid: Number,
    collectedBy: String,
    timestamp: Date
  }],
  expenses: [{
    id: String,
    description: String,
    amount: Number,
    paidBy: String,
    timestamp: { type: Date, default: Date.now }
  }],
  updatedAt: { type: Date, default: Date.now }
});

// Ensure unique record per family per month
MonthlyDataSchema.index({ familyId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyData', MonthlyDataSchema);
