const express = require('express');
const path = require('path');
const { PORT } = require('./lib/constants');

const app = express();

app.disable('x-powered-by');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy',
    "default-src 'self' https://cdn.jsdelivr.net https://cdn.tailwindcss.com; " +
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.tailwindcss.com; " +
    "img-src 'self' data:; connect-src 'self'"
  );
  next();
});

require('./routes/discover')(app);
require('./routes/mutations')(app);
require('./routes/permissions')(app);
require('./routes/trash')(app);
require('./routes/exec')(app);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Claude Dashboard running at http://127.0.0.1:${PORT}`);
});
