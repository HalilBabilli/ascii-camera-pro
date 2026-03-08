const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const {
  submitLimiter,
  questionValidation,
  handleValidationErrors,
} = require('../middleware/security');

// GET - Show question form
router.get('/', (req, res) => {
  res.render('form', {
    csrfToken: req.csrfToken(),
    success: null,
    error: null,
  });
});

// POST - Submit question
router.post(
  '/',
  submitLimiter,
  questionValidation,
  (req, res, next) => {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('form', {
        csrfToken: req.csrfToken(),
        success: null,
        error: errors.array().map(e => e.msg).join('. '),
      });
    }
    next();
  },
  async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;

      await pool.query(
        'INSERT INTO questions (client_name, client_email, subject, message) VALUES ($1, $2, $3, $4)',
        [name, email, subject, message]
      );

      res.render('form', {
        csrfToken: req.csrfToken(),
        success: 'Your question has been submitted successfully. We will get back to you soon.',
        error: null,
      });
    } catch (err) {
      console.error('Error saving question:', err);
      res.render('form', {
        csrfToken: req.csrfToken(),
        success: null,
        error: 'Something went wrong. Please try again.',
      });
    }
  }
);

module.exports = router;
