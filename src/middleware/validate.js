// src/middleware/validate.js
const { validationResult } = require('express-validator');
const { error }            = require('../utils/response');

/**
 * Run after express-validator chains.
 * If any errors exist, return 400 with the full list.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, 'Validation failed', 400, errors.array());
  }
  next();
}

module.exports = { validate };
