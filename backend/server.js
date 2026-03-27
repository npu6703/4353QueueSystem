const express = require('express');
const cors = require('cors');

const queueRoutes = require('./routes/queue');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

const app = express();

app.use(cors());
app.use(express.json());

app.use(queueRoutes);
app.use(adminRoutes);
app.use(authRoutes);

// Auth and service routes will be added by teammates
// app.use(serviceRoutes);

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
