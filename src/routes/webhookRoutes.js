const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");

router.post('/midtrans', transactionController.midtransWebhook);

module.exports = router;