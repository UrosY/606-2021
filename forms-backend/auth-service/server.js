const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());

const SECRET = 'tajna_lozinka'; 


app.get('/', (req, res) => {
  res.send('Auth service is running!');
});

//  Registracija
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email i password su obavezni' });
    }

    
    const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email već postoji' });
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hash]);

    res.json({ message: 'User registered' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška pri registraciji', details: err.message });
  }
});

//  Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email i password su obavezni' });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) return res.status(401).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška pri loginu', details: err.message });
  }
});

module.exports = app;
app.listen(3001, () => console.log('Auth service running on port 3001'));