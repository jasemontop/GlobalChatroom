const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const DATA = path.join(__dirname, 'reviews.json');

async function readReviews() {
  try { return JSON.parse(await fs.readFile(DATA, 'utf8') || '[]'); } catch (e) { return []; }
}

app.post('/submit', async (req, res) => {
  const body = req.body || {};
  if (!body.rating) return res.status(400).json({ error: 'rating required' });
  const review = { rating: body.rating, feedback: body.feedback || '', user: body.user || 'Anonymous', timestamp: Date.now() };
  const arr = await readReviews();
  arr.push(review);
  await fs.writeFile(DATA, JSON.stringify(arr, null, 2), 'utf8');
  res.json({ ok: true });
});

app.get('/reviews.json', async (req, res) => {
  const arr = await readReviews();
  res.json(arr);
});

// Admin UI
app.use('/', express.static(path.join(__dirname, 'admin')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('Reviews service listening on', PORT));
