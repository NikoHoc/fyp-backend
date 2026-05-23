const express = require("express");
const router = express.Router();

const expenseController = require("../controllers/expenseController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.use(authMiddleware);

router.get("/:depot_id", expenseController.getExpenses);
router.post("/", roleMiddleware(["admin", "owner"]), expenseController.createExpense);
router.put("/:id", roleMiddleware(["admin", "owner"]), expenseController.updateExpense);
router.delete("/:id", roleMiddleware(["admin", "owner"]), expenseController.deleteExpense);

module.exports = router;