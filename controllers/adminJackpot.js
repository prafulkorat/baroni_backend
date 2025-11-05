import StarWallet from '../models/StarWallet.js';
import StarTransaction from '../models/StarTransaction.js';
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import { withdrawFromJackpot } from '../services/starWalletService.js';
import { getEffectiveCommission, applyCommission } from '../utils/commissionHelper.js';

// Helper function to format date
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day} ${month} ${year} • ${hours}:${minutes} ${ampm}`;
};

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
    const users = await User.find(userMatch)
      .populate('profession', 'name')
      .select('name pseudo profilePic baroniId country contact profession isVerified role')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    const ids = users.map((u) => u._id);
    const wallets = await StarWallet.find({ starId: { $in: ids } }).lean();
    const mapWallet = new Map(wallets.map((w) => [String(w.starId), w]));

    const items = users.map((u) => ({
      starId: u._id,
      name: u.name || u.pseudo,
      pseudo: u.pseudo,
      baroniId: u.baroniId,
      profilePic: u.profilePic,
      country: u.country,
      contact: u.contact,
      profession: u.profession?.name || 'Singer',
      isVerified: u.isVerified,
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

    // Check if star has sufficient jackpot balance
    const wallet = await StarWallet.findOne({ starId });
    if (!wallet) return res.status(404).json({ success: false, message: 'Star wallet not found' });
    if (wallet.jackpot < numericAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient jackpot balance' });
    }

    // Create withdrawal request with 'approved' status (pending in UI, waiting for admin approval)
    const withdrawal = await Withdrawal.create({ 
      starId, 
      adminId: req.user._id, 
      amount: numericAmount, 
      status: 'approved', // Create as approved, then admin can approve/reject
      note 
    });
    
    return res.status(201).json({ 
      success: true, 
      data: { 
        id: withdrawal._id, 
        status: withdrawal.status,
        message: 'Withdrawal request created successfully. Use approve endpoint to process payment.'
      } 
    });
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
    
    // Map UI status to withdrawal status
    if (status) {
      if (status === 'paid') {
        match.status = 'completed';
      } else if (status === 'pending') {
        match.status = 'approved'; // Pending withdrawals are those approved but not yet processed
      } else if (status === 'failed') {
        match.status = 'failed';
      } else {
        match.status = status;
      }
    }
    
    const createdAt = parseRange(from, to);
    if (createdAt) match.createdAt = createdAt;

    const total = await Withdrawal.countDocuments(match);
    const withdrawals = await Withdrawal.find(match)
      .populate({
        path: 'starId',
        select: 'name pseudo profilePic baroniId country contact profession isVerified role',
        populate: { path: 'profession', select: 'name' }
      })
      .populate('adminId', 'name baroniId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Enrich withdrawals with commission calculations and formatted data
    const enrichedItems = await Promise.all(withdrawals.map(async (withdrawal) => {
      const star = withdrawal.starId;
      const admin = withdrawal.adminId;
      
      // Calculate commission and net amount
      let commissionAmount = 0;
      let netAmount = withdrawal.amount;
      
      // For withdrawals, commission might be stored in metadata or calculated
      // For now, using a default commission rate if available
      try {
        const countryCode = star?.country;
        // Assuming withdrawal commission is based on country
        const commissionRate = await getEffectiveCommission({ 
          serviceType: 'videoCall', // Default service type for withdrawals
          countryCode 
        });
        const { commission, netAmount: net } = applyCommission(withdrawal.amount, commissionRate);
        commissionAmount = commission;
        netAmount = net;
      } catch (err) {
        console.error('Error calculating withdrawal commission:', err);
        // Use default 10% commission if calculation fails
        commissionAmount = Math.round(withdrawal.amount * 0.1 * 100) / 100;
        netAmount = Math.round((withdrawal.amount - commissionAmount) * 100) / 100;
      }
      
      // Map withdrawal status to UI status
      let uiStatus = 'pending';
      if (withdrawal.status === 'completed') {
        uiStatus = 'paid';
      } else if (withdrawal.status === 'failed') {
        uiStatus = 'failed';
      } else if (withdrawal.status === 'approved') {
        uiStatus = 'pending';
      } else {
        uiStatus = 'pending';
      }
      
      return {
        id: withdrawal._id,
        withdrawalId: withdrawal._id,
        status: withdrawal.status,
        uiStatus: uiStatus,
        amount: withdrawal.amount,
        grossAmount: withdrawal.amount,
        commissionAmount: commissionAmount,
        netAmount: netAmount,
        note: withdrawal.note,
        createdAt: withdrawal.createdAt,
        updatedAt: withdrawal.updatedAt,
        processedAt: withdrawal.processedAt,
        formattedDate: formatDate(withdrawal.createdAt),
        operatorId: admin?._id ? admin._id.toString().slice(-8) : withdrawal.adminId?.toString().slice(-8) || 'N/A',
        errorMessage: withdrawal.status === 'failed' && withdrawal.metadata?.error ? withdrawal.metadata.error : null,
        star: star ? {
          id: star._id,
          name: star.name,
          pseudo: star.pseudo,
          baroniId: star.baroniId,
          profilePic: star.profilePic,
          country: star.country,
          contact: star.contact,
          profession: star.profession?.name || 'Singer',
          isVerified: star.isVerified,
          role: star.role
        } : null,
        admin: admin ? {
          id: admin._id,
          name: admin.name,
          baroniId: admin.baroniId
        } : null,
        metadata: withdrawal.metadata
      };
    }));

    return res.json({ success: true, data: { items: enrichedItems, page, limit, total } });
  } catch (err) {
    console.error('Error listing withdrawals:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only approved withdrawals can be processed' });
    }
    
    try {
      await withdrawFromJackpot(withdrawal.starId, withdrawal.amount, { adminId: req.user._id });
      withdrawal.status = 'completed';
      withdrawal.processedAt = new Date();
      await withdrawal.save();
      return res.json({ success: true, data: { id: withdrawal._id, status: 'completed' } });
    } catch (err) {
      withdrawal.status = 'failed';
      withdrawal.processedAt = new Date();
      withdrawal.metadata = { ...withdrawal.metadata, error: err.message };
      await withdrawal.save();
      return res.status(400).json({ success: false, message: 'Approval failed: ' + err.message });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only approved withdrawals can be rejected' });
    }
    
    withdrawal.status = 'rejected';
    withdrawal.processedAt = new Date();
    if (note) withdrawal.note = (withdrawal.note ? withdrawal.note + '\n' : '') + `Rejected: ${note}`;
    await withdrawal.save();
    
    return res.json({ success: true, data: { id: withdrawal._id, status: 'rejected' } });
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
      w.metadata = { ...w.metadata, retriedAt: new Date(), retriedBy: req.user._id };
      await w.save();
      return res.json({ success: true, data: { id: w._id, status: w.status } });
    } catch (err) {
      w.metadata = { ...w.metadata, retryError: err.message };
      await w.save();
      return res.status(400).json({ success: false, message: 'Retry failed: ' + err.message });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};


