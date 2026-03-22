// src/controllers/userController.js
const bcrypt     = require('bcryptjs');
const { query }  = require('../config/db');
const { success, error } = require('../utils/response');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10');

// ─── UPDATE BASIC USER INFO ─────────────────────────────────
async function updateUser(req, res) {
  const userId = req.user.sub;
  const { name, phone, city, address, blood_type } = req.body;

  const fields = [];
  const vals   = [];
  let   idx    = 1;

  if (name)       { fields.push(`name       = $${idx++}`); vals.push(name);       }
  if (phone)      { fields.push(`phone      = $${idx++}`); vals.push(phone);      }
  if (city)       { fields.push(`city       = $${idx++}`); vals.push(city);       }
  if (address)    { fields.push(`address    = $${idx++}`); vals.push(address);    }
  if (blood_type) { fields.push(`blood_type = $${idx++}`); vals.push(blood_type); }

  if (fields.length === 0) return error(res, 'No fields to update', 400);

  vals.push(userId);
  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}
     RETURNING id, name, email, role, blood_type, phone, city, address, updated_at`,
    vals
  );

  return success(res, result.rows[0], 'Profile updated');
}

// ─── CHANGE PASSWORD ────────────────────────────────────────
async function changePassword(req, res) {
  const { current_password, new_password } = req.body;
  const userId = req.user.sub;

  const result = await query(
    `SELECT password_hash FROM users WHERE id = $1`, [userId]
  );
  if (result.rows.length === 0) return error(res, 'User not found', 404);

  const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
  if (!valid) return error(res, 'Current password is incorrect', 400);

  const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, userId]);

  // Revoke all refresh tokens (force re-login everywhere)
  await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);

  return success(res, {}, 'Password changed. Please log in again.');
}

// ─── UPDATE HOSPITAL PROFILE ────────────────────────────────
async function updateHospitalProfile(req, res) {
  const userId = req.user.sub;
  const {
    org_name, authorized_person, hospital_type,
    bed_capacity, licence_number, phone, address,
  } = req.body;

  // Update hospital_profiles table
  const hpFields = [];
  const hpVals   = [];
  let   idx      = 1;

  if (org_name         !== undefined) { hpFields.push(`org_name          = $${idx++}`); hpVals.push(org_name);          }
  if (authorized_person!== undefined) { hpFields.push(`authorized_person = $${idx++}`); hpVals.push(authorized_person); }
  if (hospital_type    !== undefined) { hpFields.push(`hospital_type     = $${idx++}`); hpVals.push(hospital_type);     }
  if (bed_capacity     !== undefined) { hpFields.push(`bed_capacity      = $${idx++}`); hpVals.push(bed_capacity ? parseInt(bed_capacity) : null); }
  if (licence_number   !== undefined) { hpFields.push(`licence_number    = $${idx++}`); hpVals.push(licence_number);    }

  let hpResult = { rows: [{}] };
  if (hpFields.length > 0) {
    hpVals.push(userId);
    hpResult = await query(
      `UPDATE hospital_profiles SET ${hpFields.join(', ')}
       WHERE user_id = $${idx} RETURNING *`,
      hpVals
    );
    if (hpResult.rows.length === 0) return error(res, 'Hospital profile not found', 404);
  }

  // Also update phone / address on the users table if provided
  const uFields = [];
  const uVals   = [];
  let   uidx    = 1;
  if (phone   !== undefined) { uFields.push(`phone   = $${uidx++}`); uVals.push(phone);   }
  if (address !== undefined) { uFields.push(`address = $${uidx++}`); uVals.push(address); }

  let userRow = null;
  if (uFields.length > 0) {
    uVals.push(userId);
    const uRes = await query(
      `UPDATE users SET ${uFields.join(', ')} WHERE id = $${uidx} RETURNING phone, address`,
      uVals
    );
    userRow = uRes.rows[0];
  }

  return success(
    res,
    { ...hpResult.rows[0], ...(userRow || {}) },
    'Hospital profile updated'
  );
}

// ─── UPDATE DONOR PROFILE ───────────────────────────────────
async function updateDonorProfile(req, res) {
  const userId = req.user.sub;
  const { weight_kg, gender, date_of_birth } = req.body;

  const fields = [];
  const vals   = [];
  let   idx    = 1;

  if (weight_kg)     { fields.push(`weight_kg     = $${idx++}`); vals.push(weight_kg);     }
  if (gender)        { fields.push(`gender        = $${idx++}`); vals.push(gender);        }
  if (date_of_birth) { fields.push(`date_of_birth = $${idx++}`); vals.push(date_of_birth); }

  if (fields.length === 0) return error(res, 'No fields to update', 400);

  vals.push(userId);
  const result = await query(
    `UPDATE donor_profiles SET ${fields.join(', ')}
     WHERE user_id = $${idx} RETURNING *`,
    vals
  );
  return success(res, result.rows[0], 'Donor profile updated');
}

// ─── UPDATE INDIVIDUAL PROFILE ──────────────────────────────
async function updateIndividualProfile(req, res) {
  const userId = req.user.sub;
  const { date_of_birth, gender, allergies, chronic_conditions,
          medications, primary_doctor, weight_kg, height_cm } = req.body;

  const fields = [];
  const vals   = [];
  let   idx    = 1;

  const fieldMap = {
    date_of_birth, gender, allergies, chronic_conditions,
    medications, primary_doctor, weight_kg, height_cm,
  };

  Object.entries(fieldMap).forEach(([key, val]) => {
    if (val !== undefined) {
      fields.push(`${key} = $${idx++}`);
      vals.push(val);
    }
  });

  if (fields.length === 0) return error(res, 'No fields to update', 400);

  vals.push(userId);
  const result = await query(
    `UPDATE individual_profiles SET ${fields.join(', ')}
     WHERE user_id = $${idx} RETURNING *`,
    vals
  );
  return success(res, result.rows[0], 'Medical profile updated');
}

// ─── EMERGENCY CONTACTS ─────────────────────────────────────
async function getContacts(req, res) {
  const result = await query(
    `SELECT * FROM emergency_contacts WHERE user_id = $1 ORDER BY created_at`,
    [req.user.sub]
  );
  return success(res, result.rows);
}

async function addContact(req, res) {
  const { name, relationship, phone } = req.body;
  const userId = req.user.sub;

  // Max 5 contacts
  const countRes = await query(
    `SELECT COUNT(*) FROM emergency_contacts WHERE user_id = $1`, [userId]
  );
  if (parseInt(countRes.rows[0].count) >= 5) {
    return error(res, 'Maximum of 5 emergency contacts allowed', 422);
  }

  const result = await query(
    `INSERT INTO emergency_contacts (user_id, name, relationship, phone)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [userId, name, relationship, phone]
  );
  return success(res, result.rows[0], 'Contact added', 201);
}

async function deleteContact(req, res) {
  const { id } = req.params;
  const result = await query(
    `DELETE FROM emergency_contacts WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, req.user.sub]
  );
  if (result.rows.length === 0) return error(res, 'Contact not found', 404);
  return success(res, {}, 'Contact removed');
}

module.exports = {
  updateUser, changePassword,
  updateHospitalProfile, updateDonorProfile, updateIndividualProfile,
  getContacts, addContact, deleteContact,
};
