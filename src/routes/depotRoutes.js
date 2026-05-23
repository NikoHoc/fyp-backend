const express = require('express');
const router = express.Router();

const depotController = require("../controllers/depotController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.get("/", depotController.getDepots);
router.get("/:id", depotController.getDepotDetail);
router.get("/:id/menus", depotController.getDepotMenus);

router.use(authMiddleware);

router.post("/", roleMiddleware(["admin"]), depotController.createDepot);
router.put("/:id", roleMiddleware(["admin", "owner"]), depotController.updateDepot);
router.post("/:id/payment-config", roleMiddleware(["admin", "owner"]), depotController.setupPayment);
router.put("/:id/status", roleMiddleware(["admin", "kasir", "owner"]), depotController.toggleStatus);
router.delete('/:id', roleMiddleware(['admin']), depotController.deleteDepot);

router.post("/:id/menus", authMiddleware, roleMiddleware(["admin", "owner"]), depotController.assignMenus);
router.put("/:id/menus/:menuId/status", authMiddleware, roleMiddleware(["owner", "kasir"]), depotController.updateMenuStatus);

module.exports = router;