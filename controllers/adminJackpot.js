import StarWallet from '../models/StarWallet.js';
import StarTransaction from '../models/StarTransaction.js';
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import { withdrawFromJackpot } from '../services/starWalletService.js';

const parseRange = (from, to) => {
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return Object.keys(range).length ? range : undefined;
};

export const getJackpotMetrics = async (req, res) => {
  try {
    const { date, from, to } = req.query;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dateFilter = date === 'today' ? { $gte: todayStart } : parseRange(from, to);

    const walletsAgg = await StarWallet.aggregate([{ $group: { _id: null, jackpot: { $sum: '$jackpot' } } }]);
    const totalCurrentJackpot = walletsAgg[0]?.jackpot || 0;

    const paidToday = await Withdrawal.aggregate([
      { $match: { status: 'completed', ...(dateFilter ? { createdAt: dateFilter } : {}) } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const pending = await Withdrawal.aggregate([
      { $match: { status: 'approved', ...(dateFilter ? { createdAt: dateFilter } : {}) } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const failed = await Withdrawal.aggregate([
      { $match: { status: 'failed', ...(dateFilter ? { createdAt: dateFilter } : {}) } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    return res.json({
      success: true,
      data: {
        totalCurrentJackpot,
        paidToday: { count: paidToday[0]?.count || 0, amount: paidToday[0]?.amount || 0 },
        pending: { count: pending[0]?.count || 0, amount: pending[0]?.amount || 0 },
        failed: { count: failed[0]?.count || 0, amount: failed[0]?.amount || 0 }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const listStars = async (req, res) => {
  try {
    const { q } = req.query;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const userMatch = { role: 'star' };
    if (q) {
      const regex = new RegExp(q, 'i');
      userMatch.$or = [{ name: regex }, { pseudo: regex }, { baroniId: regex }];
    }
    const users = await User.find(userMatch, { _id: 1, name: 1, pseudo: 1, country: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const ids = users.map((u) => u._id);
    const wallets = await StarWallet.find({ starId: { $in: ids } }).lean();
    const mapWallet = new Map(wallets.map((w) => [String(w.starId), w]));

    const items = users.map((u) => ({
      starId: u._id,
      name: u.name || u.pseudo,
      country: u.country,
      wallet: mapWallet.get(String(u._id)) || { escrow: 0, jackpot: 0, totalEarned: 0, totalWithdrawn: 0 }
    }));

    return res.json({ success: true, data: { items, page, limit, total: items.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createWithdrawal = async (req, res) => {
  try {
    const { starId, amount, note } = req.body;
    if (!starId) return res.status(400).json({ success: false, message: 'starId required' });
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    // create approved record and execute payout
    const withdrawal = await Withdrawal.create({ starId, adminId: req.user._id, amount: numericAmount, status: 'approved', note });
    try {
      await withdrawFromJackpot(starId, numericAmount, { adminId: req.user._id });
      await Withdrawal.findByIdAndUpdate(withdrawal._id, { status: 'completed', processedAt: new Date() });
      return res.status(201).json({ success: true, data: { id: withdrawal._id, status: 'completed' } });
    } catch (err) {
      await Withdrawal.findByIdAndUpdate(withdrawal._id, { status: 'failed', processedAt: new Date(), metadata: { error: err.message } });
      return res.status(400).json({ success: false, message: 'Withdrawal failed: ' + err.message });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const listWithdrawals = async (req, res) => {
  try {
    const { status, from, to } = req.query;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const match = {};
    if (status) match.status = status;
    const createdAt = parseRange(from, to);
    if (createdAt) match.createdAt = createdAt;

    const total = await Withdrawal.countDocuments(match);
    const items = await Withdrawal.find(match).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return res.json({ success: true, data: { items, page, limit, total } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const retryWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const w = await Withdrawal.findById(id);
    if (!w) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (w.status !== 'failed') return res.status(400).json({ success: false, message: 'Only failed withdrawals can be retried' });
    try {
      await withdrawFromJackpot(w.starId, w.amount, { adminId: req.user._id });
      w.status = 'completed';
      w.processedAt = new Date();
      await w.save();
      return res.json({ success: true, data: { id: w._id, status: w.status } });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Retry failed: ' + err.message });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};


