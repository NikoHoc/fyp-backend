const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const depotRoutes = require('./depotRoutes');
const categoryRoutes = require('./categoryRoutes');
const menuRoutes = require('./menuRoutes');
const tableRoutes = require('./tableRoutes');
const userRoutes = require('./userRoutes');
const expenseRoutes = require('./expenseRoutes');
const stockRoutes = require('./stockRoutes');
const transactionRoutes = require('./transactionRoutes');
const paymentMethodRoutes = require('./paymentMethodRoutes');
const settlementRoutes = require('./settlementRoutes')
const customerRoutes = require('./customerRoutes');
const webhookRoutes = require('./webhookRoutes');

router.use('/webhook', webhookRoutes);
router.use('/auth', authRoutes);
router.use('/depots', depotRoutes);
router.use('/categories', categoryRoutes);
router.use('/menus', menuRoutes);
router.use('/tables', tableRoutes);
router.use('/users', userRoutes);
router.use('/expenses', expenseRoutes);
router.use('/stocks', stockRoutes);
router.use('/transactions', transactionRoutes);
router.use('/payment-methods', paymentMethodRoutes);
router.use('/settlements', settlementRoutes);
router.use('/customers', customerRoutes);

module.exports = router;