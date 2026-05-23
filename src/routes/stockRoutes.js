const express = require("express");
const router = express.Router();

const stockController = require("../controllers/stockController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.use(authMiddleware);

router.get("/:depot_id", stockController.getMutations);
router.post("/", roleMiddleware(["admin", "owner"]), stockController.createMutation);
router.put("/:id/process", roleMiddleware(["admin", "owner"]), stockController.processMutation);
router.put("/:id", roleMiddleware(["admin", "owner"]), stockController.updateMutation);
router.delete("/:id", roleMiddleware(["admin", "owner"]), stockController.deleteMutation);

module.exports = router;