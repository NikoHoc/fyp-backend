const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");

router.get('/midtrans', (req, res) => {
  res.status(200).json({ status: "success", message: "Midtrans Webhook is ready and listening!" });
});

router.post('/midtrans', transactionController.midtransWebhook);

module.exports = router;