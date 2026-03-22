// src/controllers/inventoryController.js
const { query }  = require('../config/db');
const { success, error } = require('../utils/response');

// GET /api/inventory — public
async function getAll(req, res) {
  const result = await query(
    `SELECT blood_type, units_available, max_capacity, status, updated_at
     FROM blood_inventory
     ORDER BY blood_type`,
  );
  return success(res, result.rows, 'Inventory fetched');
}

// GET /api/inventory/:bloodType — public
async function getOne(req, res) {
  const { bloodType } = req.params;
  const result = await query(
    `SELECT blood_type, units_available, max_capacity, status, updated_at
     FROM blood_inventory WHERE blood_type = $1`,
    [bloodType]
  );
  if (result.rows.length === 0) return error(res, 'Blood type not found', 404);
  return success(res, result.rows[0]);
}

// PATCH /api/inventory/:bloodType — hospital only
async function update(req, res) {
  const { bloodType } = req.params;
  const { units_available, max_capacity } = req.body;

  const fields = [];
  const vals   = [];
  let   idx    = 1;

  if (units_available !== undefined) { fields.push(`units_available = $${idx++}`); vals.push(units_available); }
  if (max_capacity    !== undefined) { fields.push(`max_capacity    = $${idx++}`); vals.push(max_capacity);    }

  if (fields.length === 0) return error(res, 'No fields to update', 400);

  fields.push(`updated_at = NOW()`);
  vals.push(bloodType);

  const result = await query(
    `UPDATE blood_inventory SET ${fields.join(', ')}
     WHERE blood_type = $${idx}
     RETURNING *`,
    vals
  );
  if (result.rows.length === 0) return error(res, 'Blood type not found', 404);

  // Activity log
  await query(
    `INSERT INTO activity_log (user_id, action, entity_type, description)
     VALUES ($1, 'INVENTORY_UPDATE', 'blood_inventory', $2)`,
    [req.user.sub, `Updated ${bloodType}: ${units_available} units`]
  );

  return success(res, result.rows[0], 'Inventory updated');
}

module.exports = { getAll, getOne, update };
