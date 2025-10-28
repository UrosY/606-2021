const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db'); 
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const SECRET = 'tajna_lozinka';

// Middleware za JWT
function optionalVerifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    req.user = null;
    return next();
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    req.user = null;
    return next();
  }
}

function requireToken(req, res, next) {
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

// KREIRANJE FORME
app.post('/create-form', requireToken, async (req, res) => {
  try {
    const { title, description, allowGuests, questions } = req.body;

    if (!title || title.trim() === '') 
      return res.status(400).json({ message: 'Naziv forme je obavezan!' });

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
          'INSERT INTO questions (form_id, text, type, is_required, position, image_url) VALUES (?, ?, ?, ?, ?, ?)',
          [formId, q.text.trim(), q.type, q.required ? 1 : 0, i + 1, '']
        );

        if ((q.type === 'single_choice' || q.type === 'multiple_choice') && Array.isArray(q.options)) {
          for (let opt of q.options) {
            if (!opt || opt.trim() === '') continue;
            await db.query(
              'INSERT INTO options (question_id, text, image_url) VALUES (?, ?, ?)',
              [qResult.insertId, opt.trim(), '']
            );
          }
        }
      }
    }

    res.json({ success: true, message: 'Forma je uspešno kreirana!', formId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška pri kreiranju forme', details: err.message });
  }
});

// FORME KORISNIKA (vlasnik ili kolaborator)
app.get('/my-forms', requireToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [ownedForms] = await db.query(
      'SELECT id, title, description FROM forms WHERE owner_id = ?',
      [userId]
    );

    const [collabForms] = await db.query(
      `SELECT f.id, f.title, f.description
       FROM forms f
       JOIN collaborators c ON f.id = c.form_id
       WHERE c.user_id = ?`,
      [userId]
    );

    const formsMap = new Map();
    ownedForms.concat(collabForms).forEach(f => formsMap.set(f.id, f));
    const allForms = Array.from(formsMap.values());

    res.json(allForms);
  } catch (err) {
    console.error('Greška pri učitavanju formi:', err);
    res.status(500).json({ message: 'Greška pri učitavanju formi', details: err.message });
  }
});


// GET JEDNE FORME + pitanja
app.get('/form/:id', optionalVerifyToken, async (req, res) => {
  try {
    const formId = req.params.id;
    const [[formRows]] = await db.query(
      'SELECT id, title, description, allow_anonymous, is_locked FROM forms WHERE id = ?',
      [formId]
    );
    if (!formRows) return res.status(404).json({ error: 'Forma nije pronađena' });

    const form = formRows;
    const [questions] = await db.query(
      'SELECT id, text, type, is_required, position, image_url FROM questions WHERE form_id = ? ORDER BY position ASC',
      [formId]
    );

    for (let q of questions) {
      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        const [opts] = await db.query(
          'SELECT id, text, image_url FROM options WHERE question_id = ? ORDER BY id ASC',
          [q.id]
        );
        q.options = opts;
      } else q.options = [];
    }

    res.json({ form, questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška pri učitavanju forme', details: err.message });
  }
});






// DODAVANJE KOLABORATORA
app.post('/forms/:id/collaborators', requireToken, async (req, res) => {
  try {
    const formId = req.params.id;
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ message: 'Email i uloga su obavezni.' });
    if (!['editor', 'viewer'].includes(role)) return res.status(400).json({ message: 'Uloga mora biti editor ili viewer.' });

    const [[form]] = await db.query('SELECT id, owner_id FROM forms WHERE id = ?', [formId]);
    if (!form) return res.status(404).json({ message: 'Forma nije pronađena.' });
    if (form.owner_id !== req.user.id) return res.status(403).json({ message: 'Samo vlasnik može dodavati kolaboratore.' });

    const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (!users.length) return res.status(404).json({ message: 'Korisnik nije pronađen.' });
    const userId = users[0].id;

    const [existing] = await db.query('SELECT id FROM collaborators WHERE form_id = ? AND user_id = ?', [formId, userId]);
    if (existing.length) return res.status(400).json({ message: 'Korisnik je već kolaborator.' });

    await db.query('INSERT INTO collaborators (form_id, user_id, role) VALUES (?, ?, ?)', [formId, userId, role]);
    res.json({ success: true, message: 'Kolaborator dodat.' });
  } catch (err) {
    console.error('Greška pri dodavanju kolaboratora:', err);
    res.status(500).json({ message: 'Greška pri dodavanju kolaboratora.', details: err.message });
  }
});


// PROMENA REDOSLEDA PITANJA
app.post('/form/:id/reorder', requireToken, async (req, res) => {
  try {
    const formId = req.params.id;
    const { questionOrder } = req.body;
    if (!Array.isArray(questionOrder)) return res.status(400).json({ error: 'questionOrder mora biti niz' });

    for (let i = 0; i < questionOrder.length; i++) {
      await db.query(
        'UPDATE questions SET position = ? WHERE id = ? AND form_id = ?',
        [i + 1, questionOrder[i], formId]
      );
    }

    res.json({ success: true, message: 'Redosled pitanja ažuriran' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška pri ažuriranju redosleda', details: err.message });
  }
});


// IZMENA FORME
app.put('/edit-form/:id', requireToken, async (req, res) => {
  try {
    const formId = req.params.id;
    const { title, description, questions } = req.body;

    await db.query(
      "UPDATE forms SET title = ?, description = ? WHERE id = ?",
      [title, description, formId]
    );

    
    await db.query(
      "DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE form_id = ?)",
      [formId]
    );
    await db.query("DELETE FROM questions WHERE form_id = ?", [formId]);

    
    for (let q of questions) {
      const [result] = await db.query(
        "INSERT INTO questions (form_id, text, type, is_required) VALUES (?, ?, ?, ?)",
        [formId, q.text, q.type, q.required ? 1 : 0]
      );
      const qId = result.insertId;

      if (Array.isArray(q.options)) {
        for (let opt of q.options) {
          await db.query(
            "INSERT INTO options (question_id, text) VALUES (?, ?)",
            [qId, opt.text]
          );
        }
      }
    }

    res.json({ message: "Forma uspešno ažurirana!" });
  } catch (err) {
    console.error('Greška pri ažuriranju forme:', err);
    res.status(500).json({ error: "Greška pri ažuriranju forme", details: err.message });
  }
});


app.listen(3002, () => console.log('Forms service running on port 3002'));