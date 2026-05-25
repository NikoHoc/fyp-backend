const express = require('express');
const router = express.Router();

const customerController = require('../controllers/customerController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

router.get('/me', roleMiddleware(['pelanggan']), customerController.getProfile);

router.get('/me/cart', roleMiddleware(['pelanggan']), customerController.getCart);
router.post('/me/cart/items', roleMiddleware(['pelanggan']), customerController.addOrUpdateCartItem);
router.delete('/me/cart/items/:id', roleMiddleware(['pelanggan']), customerController.removeCartItem);
router.delete('/me/cart', roleMiddleware(['pelanggan']), customerController.clearCart);

router.post('/me/checkout', roleMiddleware(['pelanggan']), customerController.checkoutCart);
router.get('/me/transactions/:id', roleMiddleware(['pelanggan']), customerController.getTrackingDetail);

module.exports = router;