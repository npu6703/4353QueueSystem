const express = require('express');
const cors = require('cors');

const queueRoutes = require('./routes/queue');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/services');
const adminQueueRoutes = require('./routes/adminQueue');

const app = express();

app.use(cors());
app.use(express.json());

app.use(queueRoutes);
app.use(adminRoutes);
app.use('/api/auth', authRoutes);

app.use(serviceRoutes);
app.use(adminQueueRoutes);

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
