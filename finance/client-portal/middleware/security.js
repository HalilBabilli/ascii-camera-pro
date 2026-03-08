const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Helmet for security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
    },
  },
});

// Rate limiter for form submissions
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 submissions per window
  message: 'Too many submissions. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation rules for question submission
const questionValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required (max 255 characters)')
    .escape(),
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('subject')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Subject is required (max 500 characters)')
    .escape(),
  body('message')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message is required (max 5000 characters)')
    .escape(),
];

// Login validation
const loginValidation = [
  body('email').trim().isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 }),
];

// Check validation results
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// Auth middleware for admin routes
function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  res.redirect('/admin/login');
}

module.exports = {
  securityHeaders,
  submitLimiter,
  loginLimiter,
  questionValidation,
  loginValidation,
  handleValidationErrors,
  requireAuth,
};
