const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db/connection');
const {
  loginLimiter,
  loginValidation,
  requireAuth,
} = require('../middleware/security');

// GET - Login page
router.get('/login', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin');
  }
  res.render('login', { csrfToken: req.csrfToken(), error: null });
});

// POST - Login
router.post('/login', loginLimiter, loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.render('login', {
        csrfToken: req.csrfToken(),
        error: 'Invalid credentials',
      });
    }

    const admin = result.rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);

    if (!valid) {
      return res.render('login', {
        csrfToken: req.csrfToken(),
        error: 'Invalid credentials',
      });
    }

    req.session.adminId = admin.id;
    req.session.adminEmail = admin.email;
    res.redirect('/admin');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', {
      csrfToken: req.csrfToken(),
      error: 'Something went wrong',
    });
  }
});

// GET - Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

// GET - Dashboard
router.get('/', requireAuth, async (req, res) => {
  try {
    const status = req.query.status || 'all';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM questions';
    let countQuery = 'SELECT COUNT(*) FROM questions';
    const params = [];
    const countParams = [];

    if (status !== 'all') {
      query += ' WHERE status = $1';
      countQuery += ' WHERE status = $1';
      params.push(status);
      countParams.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const [questions, countResult, stats] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'new') AS new_count,
          COUNT(*) FILTER (WHERE status = 'read') AS read_count,
          COUNT(*) FILTER (WHERE status = 'replied') AS replied_count,
          COUNT(*) FILTER (WHERE status = 'archived') AS archived_count
        FROM questions
      `),
    ]);

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    res.render('dashboard', {
      questions: questions.rows,
      stats: stats.rows[0],
      currentStatus: status,
      page,
      totalPages,
      adminEmail: req.session.adminEmail,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Server error');
  }
});

// POST - Update question status
router.post('/questions/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['new', 'read', 'replied', 'archived'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await pool.query(
      'UPDATE questions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );

    res.redirect(req.get('referer') || '/admin');
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST - Add admin note
router.post('/questions/:id/notes', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await pool.query(
      'UPDATE questions SET admin_notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [notes, id]
    );

    res.redirect(req.get('referer') || '/admin');
  } catch (err) {
    console.error('Notes update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST - Delete question
router.post('/questions/:id/delete', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM questions WHERE id = $1', [req.params.id]);
    res.redirect('/admin');
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
