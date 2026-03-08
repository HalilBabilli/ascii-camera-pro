require('dotenv').config();

const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const csrf = require('csurf');
const path = require('path');
const pool = require('./db/connection');
const { securityHeaders } = require('./middleware/security');
const questionRoutes = require('./routes/questions');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security headers
app.use(securityHeaders);

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Sessions with PostgreSQL store
app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

// CSRF protection
app.use(csrf());

// Routes
app.use('/', questionRoutes);
app.use('/admin', adminRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found', code: 404 });
});

// Error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', {
      message: 'Invalid form submission. Please go back and try again.',
      code: 403,
    });
  }
  console.error('Server error:', err);
  res.status(500).render('error', { message: 'Internal server error', code: 500 });
});

app.listen(PORT, () => {
  console.log(`Client Portal running on port ${PORT}`);
  console.log(`Submit questions: http://localhost:${PORT}`);
  console.log(`Admin dashboard:  http://localhost:${PORT}/admin`);
});
