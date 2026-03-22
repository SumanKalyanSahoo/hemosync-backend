// src/routes/inventory.js
const express  = require('express');
const { body, param } = require('express-validator');
const ctrl     = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// GET /api/inventory  — public (landing page live grid)
router.get('/', ctrl.getAll);

// GET /api/inventory/:bloodType  — public
router.get(
  '/:bloodType',
  [param('bloodType').isIn(['A+','A-','B+','B-','AB+','AB-','O+','O-']).withMessage('Invalid blood type')],
  validate,
  ctrl.getOne
);

// PATCH /api/inventory/:bloodType  — hospital only
router.patch(
  '/:bloodType',
  authenticate,
  authorize('hospital'),
  [
    param('bloodType').isIn(['A+','A-','B+','B-','AB+','AB-','O+','O-']),
    body('units_available').optional().isInt({ min: 0 }).withMessage('units_available must be >= 0'),
    body('max_capacity').optional().isInt({ min: 1 }).withMessage('max_capacity must be >= 1'),
  ],
  validate,
  ctrl.update
);

module.exports = router;
