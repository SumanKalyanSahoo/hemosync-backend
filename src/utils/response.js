// src/utils/response.js

/**
 * Send a standardised success response.
 */
function success(res, data = {}, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Send a standardised error response.
 */
function error(res, message = 'Internal server error', statusCode = 500, errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

/**
 * Build a paginated response envelope.
 */
function paginated(res, rows, total, page, limit) {
  return res.status(200).json({
    success: true,
    data: rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

module.exports = { success, error, paginated };
