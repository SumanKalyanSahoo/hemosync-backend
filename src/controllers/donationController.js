// src/controllers/donationController.js
const { query }  = require('../config/db');
const { success, error, paginated } = require('../utils/response');
const { generateDonationNumber }    = require('../utils/generateNumber');

// ─── SCHEDULE DONATION ──────────────────────────────────────
async function schedule(req, res) {
  const {
    donation_type, centre_name,
    appointment_date, appointment_time,
    health_notes, volume_ml,
  } = req.body;

  const donorId = req.user.sub;

  // Get donor blood type
  const userResult = await query(
    `SELECT blood_type FROM users WHERE id = $1`, [donorId]
  );
  if (userResult.rows.length === 0) return error(res, 'User not found', 404);
  const bloodType = userResult.rows[0].blood_type;

  if (!bloodType) {
    return error(res, 'Please set your blood type in your profile first', 422);
  }

  const donationNumber = generateDonationNumber();

  const result = await query(
    `INSERT INTO donation_appointments
       (donation_number, donor_id, blood_type, donation_type, volume_ml,
        centre_name, appointment_date, appointment_time, health_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      donationNumber, donorId, bloodType,
      donation_type || 'Whole Blood',
      volume_ml || 450,
      centre_name, appointment_date, appointment_time,
      health_notes || null,
    ]
  );

  await query(
    `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description)
     VALUES ($1, 'DONATION_SCHEDULED', 'donation_appointments', $2, $3)`,
    [donorId, result.rows[0].id, `Scheduled at ${centre_name} on ${appointment_date}`]
  );

  return success(res, result.rows[0], 'Appointment scheduled', 201);
}

// ─── LIST MY DONATIONS ──────────────────────────────────────
async function list(req, res) {
  const { status, page = 1, limit = 20 } = req.query;
  const donorId = req.user.sub;
  const offset  = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [`donor_id = $1`];
  const vals       = [donorId];
  let   idx        = 2;

  if (status) { conditions.push(`status = $${idx++}`); vals.push(status); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const countRes = await query(
    `SELECT COUNT(*) FROM donation_appointments ${where}`, vals
  );
  const total = parseInt(countRes.rows[0].count);

  const rows = await query(
    `SELECT * FROM donation_appointments ${where}
     ORDER BY appointment_date DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...vals, parseInt(limit), offset]
  );

  return paginated(res, rows.rows, total, parseInt(page), parseInt(limit));
}

// ─── CANCEL APPOINTMENT ─────────────────────────────────────
async function cancel(req, res) {
  const { id } = req.params;

  const result = await query(
    `UPDATE donation_appointments
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE id = $1 AND donor_id = $2
     RETURNING *`,
    [id, req.user.sub]
  );

  if (result.rows.length === 0) {
    return error(res, 'Appointment not found or not owned by you', 404);
  }

  return success(res, result.rows[0], 'Appointment cancelled');
}

// ─── MARK COMPLETE (hospital/admin use) ─────────────────────
async function complete(req, res) {
  const { id } = req.params;

  const result = await query(
    `UPDATE donation_appointments
     SET status = 'done', completed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) return error(res, 'Appointment not found', 404);

  const don = result.rows[0];

  // Update donor stats
  await query(
    `UPDATE donor_profiles
     SET total_donations  = total_donations + 1,
         streak           = streak + 1,
         last_donated_at  = NOW(),
         donor_level      = CASE
           WHEN total_donations + 1 >= 20 THEN 'Platinum'
           WHEN total_donations + 1 >= 10 THEN 'Gold'
           WHEN total_donations + 1 >= 5  THEN 'Silver'
           ELSE 'Bronze'
         END
     WHERE user_id = $1`,
    [don.donor_id]
  );

  // Increment inventory
  await query(
    `UPDATE blood_inventory
     SET units_available = LEAST(units_available + $1, max_capacity),
         updated_at      = NOW()
     WHERE blood_type = $2`,
    [Math.round((don.volume_ml || 450) / 450), don.blood_type]
  );

  return success(res, result.rows[0], 'Donation marked complete');
}

module.exports = { schedule, list, cancel, complete };
