const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const createError = require('http-errors');

// Importing DB models
const mysqlConnection = require('./models/connectMysql');
// Calling all routes
const eventsRouter = require('./routes/events');
const levelsRouter = require('./routes/levels');

// Creating express app
const app = express();

/**
 * Express App Global configurations
 */
// Logging All requests
app.use(logger('dev', { skip: (req, res) => req.method === 'OPTIONS' }));
// Disable x-powered-by in headers
app.disable('x-powered-by');
// Enable CORS
app.use(cors());
// Parse cookies
app.use(cookieParser());
// Parse incoming requests with urlencoded payloads
app.use(express.urlencoded({ extended: true }));
// JSON parser for Forms
app.use(express.json());

/** Security Compression. */
if (process.env.NODE_ENV === 'production') {
  /** Protects app from some well-known web vulnerabilities. */
  app.use(helmet());
  /** Compress all routes. */
  app.use(compression());
}

/** Test DB Connection is OK. */
(async () => {
  try {
    require('./models/initialize');
    if (process.env.NODE_ENV === 'development') {
      await mysqlConnection.sync({ force: true });
      console.log('Drop and re-sync db.');
    }
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
})();

// Routes
app.get('/', (req, res) => res.send('Silence is golden'));
// Event handlers
app.use('/events', eventsRouter);
// Level Tasks
app.use('/levels', levelsRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404, `Not Found Endpoint: ${req.url}`));
});

// Error handling from async/await functions
app.use((error, req, res, next) => {
  const { status = 500, message } = error;
  res.status(status).json({ message });
});

module.exports = app;