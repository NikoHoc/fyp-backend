const express = require("express");
const router = express.Router();
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const menuController = require("../controllers/menuController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.use(authMiddleware);

router.post("/", roleMiddleware(["admin"]), upload.single("image"), menuController.createMenu);
router.put("/:id", roleMiddleware(["admin", "owner", "kasir"]), upload.single("image"), menuController.updateMenu);
router.delete("/:id", roleMiddleware(["admin"]), menuController.deleteMenu);
router.get("/", menuController.getMenus);

module.exports = router;