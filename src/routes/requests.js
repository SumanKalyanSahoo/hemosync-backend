// src/routes/requests.js
const express  = require('express');
const { body, param, query } = require('express-validator');
const ctrl     = require('../controllers/requestController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const BLOOD_TYPES  = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const COMPONENTS   = ['Whole Blood','Packed Red Blood Cells (PRBC)','Fresh Frozen Plasma (FFP)','Platelets','Cryoprecipitate'];
const URGENCIES    = ['Normal','Urgent','Critical'];
const STATUSES     = ['pending','approved','enroute','done','cancelled'];

// POST /api/requests  — hospital or individual
router.post(
  '/',
  authenticate,
  authorize('hospital', 'individual'),
  [
    body('blood_type').isIn(BLOOD_TYPES).withMessage('Invalid blood type'),
    body('units_requested').isInt({ min: 1, max: 500 }).withMessage('Units must be 1–500'),
    body('component').optional().isIn(COMPONENTS),
    body('urgency').optional().isIn(URGENCIES),
    body('contact_phone').optional().isMobilePhone(),
  ],
  validate,
  ctrl.create
);

// GET /api/requests  — authenticated (scoped by role inside controller)
router.get(
  '/',
  authenticate,
  [
    query('status').optional().isIn(STATUSES),
    query('blood_type').optional().isIn(BLOOD_TYPES),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.list
);

// GET /api/requests/:id  — authenticated
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.getOne
);

// PATCH /api/requests/:id/status  — authenticated
router.patch(
  '/:id/status',
  authenticate,
  [
    param('id').isUUID(),
    body('status').isIn(STATUSES).withMessage(`Status must be one of: ${STATUSES.join(', ')}`),
    body('cancel_reason').optional().isString(),
  ],
  validate,
  ctrl.updateStatus
);

module.exports = router;
