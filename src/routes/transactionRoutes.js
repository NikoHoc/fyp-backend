const express = require("express");
const router = express.Router();

const transactionController = require("../controllers/transactionController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");


router.use(authMiddleware);

router.post("/", roleMiddleware(["owner", "kasir", "pelayan"]), transactionController.createTransaction);
router.post("/:id/items", roleMiddleware(["owner", "kasir", "pelayan"]), transactionController.addTransactionItems);
router.put("/:id/customer", roleMiddleware(["owner", "kasir", "pelayan"]), transactionController.updateCustomerInfo);

router.put('/:id/accept', roleMiddleware(['kasir', 'owner', 'admin']), transactionController.acceptOnlineOrder);
router.put('/:id/reject', roleMiddleware(['kasir', 'owner', 'admin']), transactionController.rejectOnlineOrder);

router.put("/:id/status", roleMiddleware(["owner", "kasir", "pelayan"]), transactionController.updateTransactionStatus);

router.get("/depot/:depot_id", transactionController.getTransactions);
router.get("/:id", transactionController.getTransactionDetail);

router.put("/:id/print-items", roleMiddleware(["owner", "kasir", "pelayan"]), transactionController.updateItemsPrintStatus);
router.put('/:id/pay', transactionController.processPayment);

router.put("/:id/items/:itemId/serve-status", authMiddleware, roleMiddleware(["owner", "kasir", "pelayan"]), transactionController.updateServeStatus);
router.put("/:id/items/:itemId/quantity", authMiddleware, roleMiddleware(["owner", "kasir", "pelayan"]), transactionController.updateItemQuantity);
router.delete("/:id/items/:itemId", authMiddleware, roleMiddleware(["owner", "kasir", "pelayan"]), transactionController.deleteTransactionItem);

module.exports = router;