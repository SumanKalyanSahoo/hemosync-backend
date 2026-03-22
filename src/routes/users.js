// src/routes/users.js
const express  = require('express');
const { body, param } = require('express-validator');
const ctrl     = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

// PATCH /api/users/me  — update basic profile (all roles)
router.patch(
  '/me',
  authenticate,
  [
    body('name').optional().trim().notEmpty(),
    body('phone').optional().isMobilePhone(),
    body('city').optional().trim(),
    body('address').optional().trim(),
    body('blood_type').optional().isIn(BLOOD_TYPES),
  ],
  validate,
  ctrl.updateUser
);

// PATCH /api/users/me/password
router.patch(
  '/me/password',
  authenticate,
  [
    body('current_password').notEmpty().withMessage('Current password is required'),
    body('new_password').isLength({ min: 8 }).withMessage('New password must be ≥ 8 characters'),
  ],
  validate,
  ctrl.changePassword
);

// PATCH /api/users/me/hospital-profile  — hospital only
router.patch(
  '/me/hospital-profile',
  authenticate,
  authorize('hospital'),
  [
    body('org_name').optional().trim().notEmpty(),
    body('authorized_person').optional().trim(),
    body('hospital_type').optional().isIn(['Government','Private','Trust / NGO']),
    body('bed_capacity').optional().isInt({ min: 1 }),
  ],
  validate,
  ctrl.updateHospitalProfile
);

// PATCH /api/users/me/donor-profile  — donor only
router.patch(
  '/me/donor-profile',
  authenticate,
  authorize('donor'),
  [
    body('weight_kg').optional().isFloat({ min: 40 }),
    body('gender').optional().isIn(['Male','Female','Other']),
    body('date_of_birth').optional().isDate(),
  ],
  validate,
  ctrl.updateDonorProfile
);

// PATCH /api/users/me/individual-profile  — individual only
router.patch(
  '/me/individual-profile',
  authenticate,
  authorize('individual'),
  [
    body('date_of_birth').optional().isDate(),
    body('gender').optional().isIn(['Male','Female','Other']),
    body('allergies').optional().trim(),
    body('weight_kg').optional().isFloat({ min: 1 }),
    body('height_cm').optional().isFloat({ min: 1 }),
  ],
  validate,
  ctrl.updateIndividualProfile
);

// ── EMERGENCY CONTACTS ──

// GET /api/users/me/contacts
router.get('/me/contacts', authenticate, ctrl.getContacts);

// POST /api/users/me/contacts
router.post(
  '/me/contacts',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('Contact name required'),
    body('relationship').trim().notEmpty().withMessage('Relationship required'),
    body('phone').isMobilePhone().withMessage('Valid phone required'),
  ],
  validate,
  ctrl.addContact
);

// DELETE /api/users/me/contacts/:id
router.delete(
  '/me/contacts/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  ctrl.deleteContact
);

module.exports = router;
