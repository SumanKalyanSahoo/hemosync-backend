// src/routes/auth.js
const express    = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/authController');
const { authenticate }  = require('../middleware/auth');
const { validate }      = require('../middleware/validate');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['hospital', 'donor', 'individual']).withMessage('Invalid role'),
    body('blood_type').optional().isIn(['A+','A-','B+','B-','AB+','AB-','O+','O-']),
  ],
  validate,
  ctrl.register
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  ctrl.login
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token required')],
  validate,
  ctrl.refreshToken
);

// POST /api/auth/logout
router.post('/logout', ctrl.logout);

// GET /api/auth/me   (protected)
router.get('/me', authenticate, ctrl.me);

module.exports = router;
