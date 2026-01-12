
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const User = require('./models/User');
const MonthlyData = require('./models/MonthlyData');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'gujjari_secure_key_123';

// Middleware: Auth
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, familyId } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, passwordHash: hashedPassword, familyId: familyId.toUpperCase() });
    await user.save();
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(400).json({ message: 'Registration failed', error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id, familyId: user.familyId, name: user.name }, JWT_SECRET);
  res.json({ token, user: { id: user._id, name: user.name, familyId: user.familyId } });
});

// --- DATA ROUTES ---
app.get('/api/data/:month', authenticate, async (req, res) => {
  const { month } = req.params;
  const { familyId } = req.user;
  let data = await MonthlyData.findOne({ familyId, month });
  
  if (!data) {
    // If no record exists for this month, check if there's a previous month to copy shops from
    const prevData = await MonthlyData.findOne({ familyId }).sort({ month: -1 });
    data = new MonthlyData({
      familyId,
      month,
      shops: prevData ? prevData.shops : [],
      rentRecords: [],
      expenses: []
    });
    await data.save();
  }
  res.json(data);
});

app.post('/api/data/:month/shops', authenticate, async (req, res) => {
  const { month } = req.params;
  const { shop } = req.body; // { id, name, baseRent }
  await MonthlyData.updateOne(
    { familyId: req.user.familyId, month },
    { $push: { shops: shop }, $set: { updatedAt: new Date() } }
  );
  res.json({ message: 'Shop added' });
});

app.put('/api/data/:month/shops/:shopId', authenticate, async (req, res) => {
  const { month, shopId } = req.params;
  const { name, baseRent } = req.body;
  await MonthlyData.updateOne(
    { familyId: req.user.familyId, month, "shops.id": shopId },
    { $set: { "shops.$.name": name, "shops.$.baseRent": baseRent, updatedAt: new Date() } }
  );
  res.json({ message: 'Shop updated' });
});

app.delete('/api/data/:month/shops/:shopId', authenticate, async (req, res) => {
  const { month, shopId } = req.params;
  await MonthlyData.updateOne(
    { familyId: req.user.familyId, month },
    { $pull: { shops: { id: shopId } }, $set: { updatedAt: new Date() } }
  );
  res.json({ message: 'Shop deleted' });
});

app.post('/api/data/:month/toggle-rent', authenticate, async (req, res) => {
  const { month } = req.params;
  const { shopId, baseRent, member } = req.body;
  const data = await MonthlyData.findOne({ familyId: req.user.familyId, month });
  const existingIndex = data.rentRecords.findIndex(r => r.shopId === shopId);

  if (existingIndex > -1) {
    const isPaid = data.rentRecords[existingIndex].status === 'Paid';
    if (isPaid) {
      data.rentRecords.splice(existingIndex, 1);
    } else {
      data.rentRecords[existingIndex].status = 'Paid';
      data.rentRecords[existingIndex].amountPaid = baseRent;
      data.rentRecords[existingIndex].collectedBy = member;
    }
  } else {
    data.rentRecords.push({
      shopId,
      status: 'Paid',
      amountPaid: baseRent,
      collectedBy: member,
      timestamp: new Date()
    });
  }
  data.updatedAt = new Date();
  await data.save();
  res.json(data);
});

app.post('/api/data/:month/expenses', authenticate, async (req, res) => {
  const { month } = req.params;
  const { expense } = req.body;
  await MonthlyData.updateOne(
    { familyId: req.user.familyId, month },
    { $push: { expenses: expense }, $set: { updatedAt: new Date() } }
  );
  res.json({ message: 'Expense added' });
});

app.delete('/api/data/:month/expenses/:expId', authenticate, async (req, res) => {
  const { month, expId } = req.params;
  await MonthlyData.updateOne(
    { familyId: req.user.familyId, month },
    { $pull: { expenses: { id: expId } }, $set: { updatedAt: new Date() } }
  );
  res.json({ message: 'Expense deleted' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
