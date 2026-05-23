const express = require('express');
const router = express.Router();
const methodController = require('../controllers/paymentMethodController');

router.get('/', methodController.getAllMethods);
router.post('/', methodController.createMethod);
router.put('/:id', methodController.updateMethod);
router.delete('/:id', methodController.deleteMethod);

module.exports = router;