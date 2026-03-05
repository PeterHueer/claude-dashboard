const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

require('./routes/discover')(app);
require('./routes/mutations')(app);
require('./routes/trash')(app);
require('./routes/exec')(app);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Claude Dashboard running at http://127.0.0.1:${PORT}`);
});
