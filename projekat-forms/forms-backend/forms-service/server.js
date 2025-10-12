const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const SECRET = 'tajna_lozinka';


function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Token missing' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token' });
  }
}


app.post('/create-form', verifyToken, async (req, res) => {
  const { title, description, allowGuests, questions } = req.body;

  if (!title || title.trim() === '') {
    return res.json({ message: 'Naziv forme je obavezan!' });
  }

 
  const [formResult] = await db.query(
    'INSERT INTO forms (title, description, allow_anonymous, owner_id) VALUES (?, ?, ?, ?)',
    [title.trim(), description || '', allowGuests ? 1 : 0, req.user.id]
  );
  const formId = formResult.insertId;

  
  if (Array.isArray(questions)) {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text || q.text.trim() === '') continue;

      const [qResult] = await db.query(
        'INSERT INTO questions (form_id, text, type, is_required, position) VALUES (?, ?, ?, ?, ?)',
        [formId, q.text.trim(), q.type, q.required ? 1 : 0, i + 1]
      );

      if ((q.type === 'single_choice' || q.type === 'multiple_choice') && Array.isArray(q.options)) {
        for (let opt of q.options) {
          if (!opt || opt.trim() === '') continue;
          await db.query(
            'INSERT INTO options (question_id, text) VALUES (?, ?)',
            [qResult.insertId, opt.trim()]
          );
        }
      }
    }
  }

  
  res.json({ message: 'Forma je uspešno kreirana!' });
});

app.listen(3002, () => console.log('Forms service running on port 3002'));