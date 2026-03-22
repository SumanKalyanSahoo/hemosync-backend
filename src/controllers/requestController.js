// src/controllers/requestController.js
const { query }   = require('../config/db');
const { success, error, paginated } = require('../utils/response');
const { generateRequestNumber }     = require('../utils/generateNumber');

// ─── CREATE REQUEST ─────────────────────────────────────────
async function create(req, res) {
  const {
    blood_type, component, units_requested, urgency,
    patient_name, delivery_location, ward, doctor_name,
    contact_phone, notes,
  } = req.body;

  const requestNumber = generateRequestNumber();

  const result = await query(
    `INSERT INTO blood_requests
       (request_number, requester_id, blood_type, component, units_requested,
        urgency, patient_name, delivery_location, ward, doctor_name, contact_phone, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      requestNumber, req.user.sub, blood_type, component || 'Whole Blood',
      units_requested, urgency || 'Normal', patient_name || null,
      delivery_location || null, ward || null, doctor_name || null,
      contact_phone || null, notes || null,
    ]
  );

  // Activity log
  await query(
    `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
     VALUES ($1, 'REQUEST_CREATED', 'blood_requests', $2, $3)`,
    [req.user.sub, result.rows[0].id, `New request ${requestNumber} for ${units_requested}u ${blood_type}`]
  );

  return success(res, result.rows[0], 'Blood request submitted', 201);
}

// ─── LIST REQUESTS ──────────────────────────────────────────
async function list(req, res) {
  const { status, blood_type, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const userId = req.user.sub;
  const role   = req.user.role;

  const conditions = [];
  const vals = [];
  let idx = 1;

  // Non-hospitals only see their own requests
  if (role !== 'hospital') {
    conditions.push(`br.requester_id = $${idx++}`);
    vals.push(userId);
  }
  if (status)     { conditions.push(`br.status = $${idx++}`);     vals.push(status);     }
  if (blood_type) { conditions.push(`br.blood_type = $${idx++}`); vals.push(blood_type); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM blood_requests br ${where}`,
    vals
  );
  const total = parseInt(countResult.rows[0].count);

  const rows = await query(
    `SELECT br.*,
            u.name  AS requester_name,
            u.email AS requester_email,
            u.role  AS requester_role
     FROM blood_requests br
     LEFT JOIN users u ON br.requester_id = u.id
     ${where}
     ORDER BY br.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...vals, parseInt(limit), offset]
  );

  return paginated(res, rows.rows, total, parseInt(page), parseInt(limit));
}

// ─── GET SINGLE REQUEST ─────────────────────────────────────
async function getOne(req, res) {
  const { id } = req.params;

  const result = await query(
    `SELECT br.*,
            u.name  AS requester_name,
            u.email AS requester_email
     FROM blood_requests br
     LEFT JOIN users u ON br.requester_id = u.id
     WHERE br.id = $1`,
    [id]
  );

  if (result.rows.length === 0) return error(res, 'Request not found', 404);

  const req_data = result.rows[0];
  // Only hospital or the owner can view
  if (req.user.role !== 'hospital' && req_data.requester_id !== req.user.sub) {
    return error(res, 'Forbidden', 403);
  }

  return success(res, req_data);
}

// ─── UPDATE STATUS ──────────────────────────────────────────
async function updateStatus(req, res) {
  const { id }           = req.params;
  const { status, cancel_reason } = req.body;

  const allowed = ['approved', 'enroute', 'done', 'cancelled'];
  if (!allowed.includes(status)) {
    return error(res, `Status must be one of: ${allowed.join(', ')}`, 400);
  }

  // Only hospitals can approve/dispatch/complete; owners can cancel their own
  if (['approved', 'enroute', 'done'].includes(status) && req.user.role !== 'hospital') {
    return error(res, 'Only hospitals can update this status', 403);
  }

  const tsField = {
    approved:  'approved_at',
    enroute:   'dispatched_at',
    done:      'delivered_at',
    cancelled: 'cancelled_at',
  }[status];

  const extra = status === 'cancelled' && cancel_reason
    ? `, cancel_reason = $3`
    : '';
  const extraVals = status === 'cancelled' && cancel_reason ? [cancel_reason] : [];

  const result = await query(
    `UPDATE blood_requests
     SET status = $1, ${tsField} = NOW() ${extra}
     WHERE id = $2
     RETURNING *`,
    [status, id, ...extraVals]
  );

  if (result.rows.length === 0) return error(res, 'Request not found', 404);

  const req_data = result.rows[0];

  // When a request is fulfilled (done), deduct units from blood_inventory
  // Return the updated inventory row so the frontend can update instantly
  // Deduct inventory when APPROVED (blood is committed/reserved for this request)
  // This gives instant feedback — stock drops the moment hospital approves
  let updatedInventory = null;
  if (status === 'approved') {
    const invResult = await query(
      `UPDATE blood_inventory
       SET units_available = GREATEST(units_available - $1, 0),
           updated_at      = NOW()
       WHERE blood_type = $2
       RETURNING *`,
      [req_data.units_requested, req_data.blood_type]
    );
    updatedInventory = invResult.rows[0] || null;
  }

  // Activity log
  await query(
    `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
     VALUES ($1, 'REQUEST_STATUS', 'blood_requests', $2, $3)`,
    [req.user.sub, id, `Status changed to ${status} — ${req_data.units_requested} units ${req_data.blood_type}`]
  );

  return success(res, {
    request:   req_data,
    inventory: updatedInventory,   // non-null only when status === 'done'
  }, `Request ${status}`);
}

module.exports = { create, list, getOne, updateStatus };
