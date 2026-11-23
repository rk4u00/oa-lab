const express = require('express');
const ordersRouter = require('./routes/orders');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/orders', ordersRouter);
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  });
  return app;
}

module.exports = { createApp };
