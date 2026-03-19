const http = require('http');
const app = require('./app');
const { connectToDatabase } = require('./config/db');
const { PORT } = require('./config/env');

(async () => {
  await connectToDatabase();
  const server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
})();

