// src/controllers/authController.js
const bcrypt      = require('bcryptjs');
const { query }   = require('../config/db');
const { buildTokenPair, verifyRefreshToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10');

// ─── REGISTER ──────────────────────────────────────────────
async function register(req, res) {
  const { name, email, password, role, blood_type, phone, city, org_name } = req.body;

  // Check email uniqueness
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return error(res, 'Email already registered', 409);
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Begin transaction
  const client = require('../config/db').getClient
    ? (await require('../config/db').getClient())
    : null;

  try {
    await query('BEGIN');

    // Insert user
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash, role, blood_type, phone, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role, blood_type, phone, city, created_at`,
      [name, email, hash, role, blood_type || null, phone || null, city || null]
    );
    const user = userResult.rows[0];

    // Create role-specific profile
    if (role === 'hospital') {
      await query(
        `INSERT INTO hospital_profiles (user_id, org_name, authorized_person)
         VALUES ($1, $2, $3)`,
        [user.id, org_name || name, name]
      );
    } else if (role === 'donor') {
      await query(
        `INSERT INTO donor_profiles (user_id)
         VALUES ($1)`,
        [user.id]
      );
    } else if (role === 'individual') {
      await query(
        `INSERT INTO individual_profiles (user_id)
         VALUES ($1)`,
        [user.id]
      );
    }

    await query('COMMIT');

    const tokens = buildTokenPair(user);

    // Store refresh token in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokens.refreshToken, expiresAt]
    );

    return success(res, { user, ...tokens }, 'Account created successfully', 201);
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
}

// ─── LOGIN ─────────────────────────────────────────────────
async function login(req, res) {
  const { email, password } = req.body;

  const result = await query(
    `SELECT id, name, email, password_hash, role, blood_type, phone, city, is_active
     FROM users WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    return error(res, 'Invalid email or password', 401);
  }

  const user = result.rows[0];

  if (!user.is_active) {
    return error(res, 'Account has been deactivated', 403);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return error(res, 'Invalid email or password', 401);
  }

  const tokens = buildTokenPair(user);

  // Store refresh token
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokens.refreshToken, expiresAt]
  );

  // Log activity
  await query(
    `INSERT INTO activity_log (user_id, action, description, ip_address)
     VALUES ($1, 'LOGIN', $2, $3)`,
    [user.id, `User ${user.email} logged in`, req.ip]
  );

  // Remove hash from response
  delete user.password_hash;

  return success(res, { user, ...tokens }, 'Login successful');
}

// ─── REFRESH TOKEN ─────────────────────────────────────────
async function refreshToken(req, res) {
  const { refreshToken: token } = req.body;
  if (!token) return error(res, 'Refresh token required', 400);

  // Verify JWT signature
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    return error(res, 'Invalid or expired refresh token', 401);
  }

  // Check token is in DB and not expired
  const stored = await query(
    `SELECT id, user_id, expires_at FROM refresh_tokens
     WHERE token = $1 AND user_id = $2 AND expires_at > NOW()`,
    [token, decoded.sub]
  );

  if (stored.rows.length === 0) {
    return error(res, 'Refresh token revoked or expired', 401);
  }

  // Rotate: delete old, issue new pair
  await query('DELETE FROM refresh_tokens WHERE token = $1', [token]);

  const userResult = await query(
    `SELECT id, name, email, role, blood_type FROM users WHERE id = $1`,
    [decoded.sub]
  );
  const user = userResult.rows[0];
  const tokens = buildTokenPair(user);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokens.refreshToken, expiresAt]
  );

  return success(res, tokens, 'Tokens refreshed');
}

// ─── LOGOUT ────────────────────────────────────────────────
async function logout(req, res) {
  const { refreshToken: token } = req.body;
  if (token) {
    await query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
  }
  return success(res, {}, 'Logged out successfully');
}

// ─── ME (current user) ─────────────────────────────────────
async function me(req, res) {
  const userId = req.user.sub;

  const result = await query(
    `SELECT id, name, email, role, blood_type, phone, city, address, is_verified, created_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return error(res, 'User not found', 404);

  const user = result.rows[0];

  // Attach role-specific profile
  let profile = null;
  if (user.role === 'hospital') {
    const p = await query(`SELECT * FROM hospital_profiles WHERE user_id = $1`, [userId]);
    profile = p.rows[0] || null;
  } else if (user.role === 'donor') {
    const p = await query(`SELECT * FROM donor_profiles WHERE user_id = $1`, [userId]);
    profile = p.rows[0] || null;
  } else if (user.role === 'individual') {
    const p = await query(`SELECT * FROM individual_profiles WHERE user_id = $1`, [userId]);
    profile = p.rows[0] || null;
  }

  return success(res, { user, profile }, 'User retrieved');
}

module.exports = { register, login, refreshToken, logout, me };
