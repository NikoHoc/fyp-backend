const express = require("express");
const router = express.Router();
const settlementController = require("../controllers/settlementController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.use(authMiddleware);

router.get("/today/:depot_id", roleMiddleware(["admin", "owner", "kasir"]), settlementController.getTodaySummary);
router.post("/process", roleMiddleware(["admin", "owner", "kasir"]), settlementController.processSettlement);

router.get("/depot/:depot_id", authMiddleware, roleMiddleware(["admin", "owner", "kasir"]), settlementController.getSettlements);
router.get("/detail/:id", authMiddleware, roleMiddleware(["admin", "owner", "kasir"]), settlementController.getSettlementDetail);
router.get("/detail/:id/transactions", roleMiddleware(["admin", "owner", "kasir"]), settlementController.getSettlementTransactions);

module.exports = router;