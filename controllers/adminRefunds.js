import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { refundTransaction } from '../services/transactionService.js';

const parseRange = (from, to) => {
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return Object.keys(range).length ? range : undefined;
};

export const getRefundMetrics = async (req, res) => {
  try {
    const { from, to, service } = req.query;
    const match = {};
    const createdAt = parseRange(from, to);
    if (createdAt) match.createdAt = createdAt;
    if (service) match.type = service;

    const totalRefundedAgg = await Transaction.aggregate([
      { $match: { ...match, status: 'refunded' } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const failedAgg = await Transaction.aggregate([
      { $match: { ...match, status: 'failed' } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const pendingAgg = await Transaction.aggregate([
      { $match: { ...match, status: { $in: ['pending', 'initiated'] } } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    return res.json({
      success: true,
      data: {
        totalRefunded: { count: totalRefundedAgg[0]?.count || 0, amount: totalRefundedAgg[0]?.amount || 0 },
        pendingRefunds: { count: pendingAgg[0]?.count || 0, amount: pendingAgg[0]?.amount || 0 },
        failedRefunds: { count: failedAgg[0]?.count || 0, amount: failedAgg[0]?.amount || 0 },
        avgCommissionTimeSec: 0
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const listRefundables = async (req, res) => {
  try {
    const { q, status, service, from, to } = req.query;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const match = {};
    if (status) match.status = status;
    if (service) match.type = service;
    const createdAt = parseRange(from, to);
    if (createdAt) match.createdAt = createdAt;

    // basic search by payer/receiver name or pseudo or baroniId
    let userIds = [];
    if (q) {
      const regex = new RegExp(q, 'i');
      const users = await User.find({ $or: [{ name: regex }, { pseudo: regex }, { baroniId: regex }] }, { _id: 1 });
      userIds = users.map((u) => u._id);
      match.$or = [{ payerId: { $in: userIds } }, { receiverId: { $in: userIds } }];
    }

    const total = await Transaction.countDocuments(match);
    const items = await Transaction.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({ success: true, data: { items, page, limit, total } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const triggerRefund = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const result = await refundTransaction(transactionId);
    return res.json({ success: true, message: result.message });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};


