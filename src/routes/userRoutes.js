const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

router.get('/profile', userController.getMyProfile);
router.put('/profile', userController.updateMyProfile);

router.get('/employees', roleMiddleware(['admin']), userController.getEmployees);
router.post('/employees', roleMiddleware(['admin']), userController.createEmployee);
router.put('/employees/:id', roleMiddleware(['admin']), userController.updateEmployee);
router.delete('/employees/:id', roleMiddleware(['admin']), userController.deleteEmployee);

router.get('/customers', roleMiddleware(['admin']), userController.getCustomers);
router.post('/customers', roleMiddleware(['admin']), userController.createCustomer);
router.put('/customers/:id', roleMiddleware(['admin']), userController.updateCustomer);
router.delete('/customers/:id', roleMiddleware(['admin']), userController.deleteCustomer);

module.exports = router;