require('dotenv').config();
const pool = require('./connection');
const bcrypt = require('bcrypt');

const schema = `
  CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'new',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
  CREATE INDEX IF NOT EXISTS idx_questions_created ON questions(created_at DESC);

  CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
`;

async function init() {
  try {
    await pool.query(schema);
    console.log('Database tables created.');

    // Create admin user if not exists
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'changeme';

    const existing = await pool.query('SELECT id FROM admins WHERE email = $1', [email]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query('INSERT INTO admins (email, password_hash) VALUES ($1, $2)', [email, hash]);
      console.log(`Admin user created: ${email}`);
    } else {
      console.log(`Admin user already exists: ${email}`);
    }

    console.log('Database initialization complete.');
  } catch (err) {
    console.error('Database initialization failed:', err.message);
  } finally {
    await pool.end();
  }
}

init();
