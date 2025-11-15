import {getAllStars, getStarById, becomeStar, getBaroniIdPatterns} from "../../controllers/star.js";
import { createWithdrawalRequest, getMyWithdrawalRequests, getMyWalletBalance } from "../../controllers/starJackpot.js";
import { createWithdrawalRequestValidator, getMyWithdrawalRequestsValidator } from "../../validators/jackpotWithdrawalValidators.js";
import express from "express";
import {requireAuth} from "../../middlewares/auth.js";

const router = express.Router();

router.use(requireAuth);

// Star Jackpot Withdrawal Routes (must be before /:id route to avoid conflicts)
router.post("/jackpot/withdrawal-request", createWithdrawalRequestValidator, createWithdrawalRequest);
router.get("/jackpot/withdrawal-requests", getMyWithdrawalRequestsValidator, getMyWithdrawalRequests);
router.get("/jackpot/balance", getMyWalletBalance);

router.get("/", getAllStars);
router.get("/patterns", getBaroniIdPatterns);
router.get("/:id", getStarById);
router.post("/become", becomeStar);

export default router;