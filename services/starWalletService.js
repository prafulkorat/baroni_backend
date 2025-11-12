import StarWallet from '../models/StarWallet.js';
import StarTransaction from '../models/StarTransaction.js';
import mongoose from 'mongoose';

/**
 * Get or create star wallet for a star
 * @param {string} starId - Star user ID
 * @returns {Promise<Object>} Star wallet
 */
export const getOrCreateStarWallet = async (starId) => {
  let wallet = await StarWallet.findOne({ starId });
  
  if (!wallet) {
    wallet = await StarWallet.create({ starId });
  }
  
  return wallet;
};

/**
 * Add amount to escrow (when payment is successful but call not completed)
 * @param {string} starId - Star user ID
 * @param {number} amount - Amount to add to escrow
 * @param {Object} metadata - Additional metadata (appointmentId, dedicationId, etc.)
 * @param {Object} providedSession - Optional MongoDB session
 * @returns {Promise<Object>} Updated wallet and created transaction
 */
export const addToEscrow = async (starId, amount, metadata = {}, providedSession = null) => {
  const shouldStartSession = !providedSession;
  const session = providedSession || await mongoose.startSession();
  
  try {
    let result;
    
    const runTransaction = async () => {
      // Get or create wallet
      let wallet = await StarWallet.findOne({ starId }).session(session);
      
      if (!wallet) {
        const wallets = await StarWallet.create([{ starId }], { session });
        wallet = wallets[0];
      }
      
      // Update escrow amount
      wallet.escrow += amount;
      wallet.totalEarned += amount;
      await wallet.save({ session });
      
      // Create star transaction record
      const starTransactions = await StarTransaction.create([{
        starId,
        fanId: metadata.fanId,
        appointmentId: metadata.appointmentId,
        dedicationId: metadata.dedicationId,
        transactionId: metadata.transactionId,
        amount,
        type: metadata.type || 'appointment',
        status: 'pending',
        escrowMovement: 'deposit'
      }], { session });
      
      result = {
        wallet,
        starTransaction: starTransactions[0]
      };
    };
    
    if (shouldStartSession) {
      await session.withTransaction(runTransaction);
    } else {
      await runTransaction();
    }
    
    return result;
  } catch (error) {
    console.error('Error adding to escrow:', error);
    throw error;
  } finally {
    if (shouldStartSession) {
      await session.endSession();
    }
  }
};

/**
 * Move amount from escrow to jackpot (when call is completed)
 * @param {string} starId - Star user ID
 * @param {string} appointmentId - Optional appointment ID
 * @param {string} dedicationId - Optional dedication ID
 * @returns {Promise<Object>} Updated wallet and updated transaction
 */
export const moveEscrowToJackpot = async (starId, appointmentId = null, dedicationId = null) => {
  const session = await mongoose.startSession();
  
  try {
    let result;
    await session.withTransaction(async () => {
      // Find pending star transaction for this appointment/dedication
      let filter = { starId, status: 'pending', escrowMovement: 'deposit' };
      if (appointmentId) {
        filter.appointmentId = appointmentId;
      }
      if (dedicationId) {
        filter.dedicationId = dedicationId;
      }
      
      const starTransaction = await StarTransaction.findOne(filter).session(session);
      
      if (!starTransaction) {
        throw new Error('No pending star transaction found');
      }
      
      const wallet = await StarWallet.findOne({ starId }).session(session);
      
      if (!wallet) {
        throw new Error('Star wallet not found');
      }
      
      // Check if escrow has sufficient amount
      if (wallet.escrow < starTransaction.amount) {
        throw new Error('Insufficient escrow balance');
      }
      
      // Move from escrow to jackpot
      wallet.escrow -= starTransaction.amount;
      wallet.jackpot += starTransaction.amount;
      
      await wallet.save({ session });
      
      // Update star transaction status
      starTransaction.status = 'completed';
      starTransaction.escrowMovement = 'release';
      starTransaction.completedAt = new Date();
      
      await starTransaction.save({ session });
      
      result = {
        wallet,
        starTransaction
      };
    });
    
    return result;
  } catch (error) {
    console.error('Error moving escrow to jackpot:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};

/**
 * Refund amount from escrow (when appointment/dedication is cancelled)
 * @param {string} starId - Star user ID
 * @param {string} appointmentId - Optional appointment ID
 * @param {string} dedicationId - Optional dedication ID
 * @returns {Promise<Object>} Updated wallet and updated transaction
 */
export const refundEscrow = async (starId, appointmentId = null, dedicationId = null) => {
  const session = await mongoose.startSession();
  
  try {
    let result;
    await session.withTransaction(async () => {
      // Find pending star transaction for this appointment/dedication
      let filter = { starId, status: 'pending' };
      if (appointmentId) {
        filter.appointmentId = appointmentId;
      }
      if (dedicationId) {
        filter.dedicationId = dedicationId;
      }
      
      const starTransaction = await StarTransaction.findOne(filter).session(session);
      
      if (!starTransaction) {
        throw new Error('No pending star transaction found for refund');
      }
      
      const wallet = await StarWallet.findOne({ starId }).session(session);
      
      if (!wallet) {
        throw new Error('Star wallet not found');
      }
      
      // Refund from escrow (deduct from escrow and totalEarned)
      wallet.escrow -= starTransaction.amount;
      wallet.totalEarned -= starTransaction.amount;
      
      await wallet.save({ session });
      
      // Update star transaction status
      starTransaction.status = 'refunded';
      
      await starTransaction.save({ session });
      
      result = {
        wallet,
        starTransaction
      };
    });
    
    return result;
  } catch (error) {
    console.error('Error refunding escrow:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};

/**
 * Get star wallet details
 * @param {string} starId - Star user ID
 * @returns {Promise<Object>} Star wallet
 */
export const getStarWallet = async (starId) => {
  return await getOrCreateStarWallet(starId);
};

/**
 * Get star transaction history
 * @param {string} starId - Star user ID
 * @param {Object} options - Query options (status, type, page, limit)
 * @returns {Promise<Object>} Transaction history with pagination
 */
export const getStarTransactions = async (starId, options = {}) => {
  const { status, type, page = 1, limit = 10 } = options;
  
  const filter = { starId };
  
  if (status) filter.status = status;
  if (type) filter.type = type;
  
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;
  
  const [totalCount, items] = await Promise.all([
    StarTransaction.countDocuments(filter),
    StarTransaction.find(filter)
      .populate('fanId', 'name pseudo profilePic')
      .populate('appointmentId', 'date time price status')
      .populate('dedicationId', 'trackingId occasion eventName price status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
  ]);
  
  return {
    items,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalCount,
      limit: limitNum
    }
  };
};

/**
 * Withdraw amount from jackpot to external payout (admin only)
 * Creates a star transaction entry with type 'withdrawal' and updates totals
 */
export const withdrawFromJackpot = async (starId, amount, metadata = {}, providedSession = null) => {
  if (amount <= 0) throw new Error('Amount must be greater than 0');
  const shouldStartSession = !providedSession;
  const session = providedSession || await mongoose.startSession();

  try {
    let result;
    const run = async () => {
      const wallet = await StarWallet.findOne({ starId }).session(session);
      if (!wallet) throw new Error('Star wallet not found');
      if (wallet.jackpot < amount) throw new Error('Insufficient jackpot balance');

      wallet.jackpot -= amount;
      wallet.totalWithdrawn += amount;
      await wallet.save({ session });

      const txns = await StarTransaction.create([
        {
          starId,
          amount,
          type: 'withdrawal',
          status: 'completed',
          escrowMovement: 'release',
          completedAt: new Date(),
          ...('adminId' in metadata ? { fanId: metadata.adminId } : {})
        }
      ], { session });

      result = { wallet, starTransaction: txns[0] };
    };

    if (shouldStartSession) {
      await session.withTransaction(run);
    } else {
      await run();
    }

    return result;
  } finally {
    if (shouldStartSession) await session.endSession();
  }
};

