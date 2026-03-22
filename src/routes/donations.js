// src/routes/donations.js
const express  = require('express');
const { body, param, query } = require('express-validator');
const ctrl     = require('../controllers/donationController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// POST /api/donations  — donor only
router.post(
  '/',
  authenticate,
  authorize('donor'),
  [
    body('centre_name').trim().notEmpty().withMessage('Donation centre is required'),
    body('appointment_date').isDate().withMessage('Valid date required (YYYY-MM-DD)'),
    body('appointment_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Valid time required (HH:MM)'),
    body('donation_type').optional().isIn([
      'Whole Blood','Packed Red Blood Cells (PRBC)',
      'Fresh Frozen Plasma (FFP)','Platelets','Cryoprecipitate',
    ]),
    body('volume_ml').optional().isInt({ min: 100, max: 1000 }),
  ],
  validate,
  ctrl.schedule
);

// GET /api/donations  — donor sees their own; hospital sees all
router.get(
  '/',
  authenticate,
  [
    query('status').optional().isIn(['scheduled','done','cancelled']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.list
);

// DELETE /api/donations/:id  — donor cancels their appointment
router.delete(
  '/:id',
  authenticate,
  authorize('donor'),
  [param('id').isUUID()],
  validate,
  ctrl.cancel
);

// PATCH /api/donations/:id/complete  — hospital marks donation done
router.patch(
  '/:id/complete',
  authenticate,
  authorize('hospital'),
  [param('id').isUUID()],
  validate,
  ctrl.complete
);

module.exports = router;
