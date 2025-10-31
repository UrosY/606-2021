const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db'); 
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const ExcelJS = require('exceljs');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const SECRET = 'tajna_lozinka';

const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });
const answerUpload = multer({ storage: memoryStorage });


function optionalVerifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) { req.user = null; return next(); }
  const token = authHeader.split(' ')[1];
  if (!token) { req.user = null; return next(); }
  try { req.user = jwt.verify(token, SECRET); } catch { req.user = null; }
  next();
}

function requireToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Token missing' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { return res.status(403).json({ message: 'Invalid token' }); }
}

// CREATE FORM sa slikama (LONGLOB)
app.post('/create-form', requireToken, upload.array('images'), async (req, res) => {
  try {
    const { title, description, allowGuests, questions } = JSON.parse(req.body.data);
    if (!title || title.trim() === '') return res.status(400).json({ message: 'Naziv forme je obavezan!' });

    const [formResult] = await db.query(
      'INSERT INTO forms (title, description, allow_anonymous, owner_id) VALUES (?, ?, ?, ?)',
      [title.trim(), description || '', allowGuests ? 1 : 0, req.user.id]
    );
    const formId = formResult.insertId;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text) continue;

      let imageData = null;
      if (req.files && req.files[i]) imageData = req.files[i].buffer;

      const [qResult] = await db.query(
        'INSERT INTO questions (form_id, text, type, is_required, position, image) VALUES (?, ?, ?, ?, ?, ?)',
        [formId, q.text.trim(), q.type, q.required ? 1 : 0, i + 1, imageData]
      );

      if ((q.type === 'single_choice' || q.type === 'multiple_choice') && Array.isArray(q.options)) {
        for (let opt of q.options) {
          if (!opt) continue;
          await db.query(
            'INSERT INTO options (question_id, text) VALUES (?, ?)',
            [qResult.insertId, opt]
          );
        }
      }
    }

    res.json({ success: true, message: 'Forma je uspešno kreirana!', formId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greška pri kreiranju forme', details: err.message });
  }
});

// GET FORMES I QUESTIONS
app.get('/my-forms', requireToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [ownedForms] = await db.query('SELECT id, title, description FROM forms WHERE owner_id = ?', [userId]);
    const [collabForms] = await db.query(`
      SELECT f.id, f.title, f.description
      FROM forms f
      JOIN collaborators c ON f.id = c.form_id
      WHERE c.user_id = ?`, [userId]);

    const formsMap = new Map();
    ownedForms.concat(collabForms).forEach(f => formsMap.set(f.id, f));
    res.json(Array.from(formsMap.values()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greška pri učitavanju formi', details: err.message });
  }
});

// GET FORM SA PITANJIMA
app.get('/form/:id', optionalVerifyToken, async (req, res) => {
  try {
    const formId = req.params.id;

    
    const [[formRow]] = await db.query(
      'SELECT id, title, description, allow_anonymous, is_locked FROM forms WHERE id = ?',
      [formId]
    );
    if (!formRow) return res.status(404).json({ error: 'Forma nije pronađena' });

    
    const [questions] = await db.query(
      'SELECT id, text, type, is_required, position, image FROM questions WHERE form_id = ? ORDER BY position ASC',
      [formId]
    );

    for (let q of questions) {
      
      if (q.image && q.image.length > 0) {
        const base64 = Buffer.from(q.image).toString('base64');
        
        q.imageBase64 = `data:image/jpeg;base64,${base64}`;
      } else {
        q.imageBase64 = null; 
      }

      
      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        const [opts] = await db.query(
          'SELECT id, text FROM options WHERE question_id = ? ORDER BY id ASC',
          [q.id]
        );
        q.options = opts;
      } else {
        q.options = [];
      }
    }

    res.json({ form: formRow, questions });
  } catch (err) {
    console.error('Greška pri učitavanju forme:', err);
    res.status(500).json({ error: 'Greška pri učitavanju forme', details: err.message });
  }
});
// SLANJE ODGOVORA SA SLIKAMA
app.post('/form/:id/submit', optionalVerifyToken, answerUpload.array('answerImages'), async (req, res) => {
  try {
    const formId = req.params.id;
    const payload = JSON.parse(req.body.data); // JSON sa odgovorima

    const [[formRow]] = await db.query('SELECT id, allow_anonymous, is_locked FROM forms WHERE id = ?', [formId]);
    if (!formRow) return res.status(404).json({ error: 'Forma nije pronađena' });
    if (formRow.is_locked) return res.status(403).json({ error: 'Forma je zaključana' });
    if (!formRow.allow_anonymous && !req.user) return res.status(401).json({ error: 'Morate biti prijavljeni da popunite ovu formu' });

    const userId = req.user ? req.user.id : null;
    const [respResult] = await db.query('INSERT INTO responses (form_id, user_id) VALUES (?, ?)', [formId, userId]);
    const responseId = respResult.insertId;

    let fileIndex = 0;

    if (Array.isArray(payload.answers)) {
      for (let a of payload.answers) {
        const qId = a.questionId;
        const qType = a.type;

        let imageData = null;
        if (req.files && req.files[fileIndex]) {
          imageData = req.files[fileIndex].buffer;
          fileIndex++;
        }

        let answerText = null;
        if (['short_text','long_text','numeric','date','time'].includes(qType)) {
          answerText = a.value ? String(a.value) : null;
        } else if (qType === 'single_choice') {
          answerText = a.selectedOptionId ? String(a.selectedOptionId) : null;
        }

        const [ansRes] = await db.query(
          'INSERT INTO answers (response_id, question_id, answer_text, image) VALUES (?, ?, ?, ?)',
          [responseId, qId, answerText, imageData]
        );
        const answerId = ansRes.insertId;

        if (qType === 'multiple_choice' && Array.isArray(a.selectedOptionIds)) {
          for (let optId of a.selectedOptionIds) {
            await db.query('INSERT INTO answer_options (answer_id, option_id) VALUES (?, ?)', [answerId, optId]);
          }
        }
      }
    }

    res.json({ success: true, message: 'Odgovori su uspešno poslati sa slikama' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška pri slanju odgovora', details: err.message });
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
    console.error(err);
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
      await db.query('UPDATE questions SET position = ? WHERE id = ? AND form_id = ?', [i + 1, questionOrder[i], formId]);
    }

    res.json({ success: true, message: 'Redosled pitanja ažuriran' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška pri ažuriranju redosleda', details: err.message });
  }
});

// IZMENA FORME
app.put('/edit-form/:id', requireToken, upload.array('images'), async (req, res) => {
  try {
    const formId = req.params.id;
    const { title, description, questions } = JSON.parse(req.body.data);

    await db.query("UPDATE forms SET title = ?, description = ? WHERE id = ?", [title, description, formId]);
    await db.query("DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE form_id = ?)", [formId]);
    await db.query("DELETE FROM questions WHERE form_id = ?", [formId]);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      let imageData = null;
      if (req.files && req.files[i]) imageData = req.files[i].buffer;

      const [result] = await db.query(
        "INSERT INTO questions (form_id, text, type, is_required, image) VALUES (?, ?, ?, ?, ?)",
        [formId, q.text, q.type, q.required ? 1 : 0, imageData]
      );
      const qId = result.insertId;

      if (Array.isArray(q.options)) {
        for (let opt of q.options) {
          await db.query("INSERT INTO options (question_id, text) VALUES (?, ?)", [qId, opt]);
        }
      }
    }

    res.json({ message: "Forma uspešno ažurirana!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Greška pri ažuriranju forme", details: err.message });
  }
});

// BRISANJE FORME
app.delete("/forms/:id", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Nedostaje token." });
  const token = authHeader.split(" ")[1];
  let decoded;
  try { decoded = jwt.verify(token, SECRET); } catch { return res.status(403).json({ message: "Neispravan token." }); }

  const userId = decoded.id;
  const formId = req.params.id;

  try {
    const [form] = await db.query("SELECT * FROM forms WHERE id = ? AND owner_id = ?", [formId, userId]);
    if (form.length === 0) return res.status(403).json({ message: "Ne možete da obrišete ovu formu jer niste njen kreator." });

    await db.query("DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE form_id = ?)", [formId]);
    await db.query("DELETE FROM questions WHERE form_id = ?", [formId]);
    await db.query("DELETE FROM forms WHERE id = ?", [formId]);

    res.json({ message: "Forma i sva njena pitanja su uspešno obrisani." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Greška pri brisanju forme." });
  }
});

// LISTA REZULTATA
app.get('/my-results', requireToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [forms] = await db.query('SELECT id, title, description FROM forms WHERE owner_id = ?', [userId]);
    const results = [];

    for (const form of forms) {
      const [responses] = await db.query(`
        SELECT r.id AS response_id, r.submitted_at, u.name AS user_name, u.email AS user_email, f.title AS form_title
        FROM responses r
        LEFT JOIN users u ON r.user_id = u.id
        JOIN forms f ON r.form_id = f.id
        WHERE r.form_id = ?
        ORDER BY r.submitted_at DESC`, [form.id]);
      results.push({ form_id: form.id, title: form.title, description: form.description, responses });
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greška pri učitavanju rezultata', details: err.message });
  }
});

// JEDAN ODGOVOR SA PITANJIMA
app.get('/response/:id', requireToken, async (req, res) => {
  try {
    const responseId = req.params.id;

    
    const [[response]] = await db.query(`
      SELECT r.*, f.title AS form_title, f.id AS form_id
      FROM responses r
      JOIN forms f ON r.form_id = f.id
      WHERE r.id = ?
    `, [responseId]);

    if (!response) {
      return res.status(404).json({ message: 'Odgovor nije pronađen.' });
    }

    
    if (response.user_id !== req.user.id && response.owner_id !== req.user.id) {
      
      
      const [[formOwner]] = await db.query(`SELECT owner_id FROM forms WHERE id = ?`, [response.form_id]);
      if (!formOwner || formOwner.owner_id !== req.user.id) {
        return res.status(403).json({ message: 'Nemate pristup ovom odgovoru.' });
      }
    }

    
    const [rows] = await db.query(`
      SELECT 
        q.id AS question_id,
        q.text,
        q.type,
        a.answer_text AS answer,
        a.image AS image_blob,
        o.id AS option_id,
        o.text AS option_text
      FROM questions q
      LEFT JOIN answers a ON a.question_id = q.id AND a.response_id = ?
      LEFT JOIN options o ON o.question_id = q.id
      WHERE q.form_id = ?
      ORDER BY q.position ASC
    `, [responseId, response.form_id]);

    
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.question_id]) {
        grouped[row.question_id] = {
          id: row.question_id,
          text: row.text,
          type: row.type,
          answer: row.answer || null,
          options: [],
          imageBase64: null
        };
      }

      if (row.image_blob) {
        const base64 = Buffer.from(row.image_blob).toString('base64');
        grouped[row.question_id].imageBase64 = `data:image/jpeg;base64,${base64}`;
      }

      if (row.option_id) {
        grouped[row.question_id].options.push({
          id: row.option_id,
          text: row.option_text
        });
      }
    }

    res.json({
      response,
      questions: Object.values(grouped)
    });

  } catch (err) {
    console.error('Greška pri preuzimanju odgovora:', err);
    res.status(500).json({ message: 'Greška na serveru.' });
  }
});
app.get('/question-image/:id', async (req, res) => {
  const qid = req.params.id;
  const [[q]] = await db.query('SELECT image FROM questions WHERE id = ?', [qid]);
  if (!q || !q.image) return res.status(404).send('Nema slike');
  res.setHeader('Content-Type', 'image/jpeg'); 
  res.send(q.image);
});
app.get('/form/:id/grouped-answers', requireToken, async (req, res) => {
  try {
    const formId = req.params.id;

    
    const [[formCheck]] = await db.query(
      'SELECT owner_id FROM forms WHERE id = ?',
      [formId]
    );
    if (!formCheck) return res.status(404).json({ message: 'Forma nije pronađena' });
    if (formCheck.owner_id !== req.user.id)
      return res.status(403).json({ message: 'Nemate pristup ovoj formi' });

    
    const [questions] = await db.query(
      'SELECT id, text, type, image FROM questions WHERE form_id = ? ORDER BY position ASC',
      [formId]
    );

    for (let q of questions) {
      
      if (q.image && q.image.length > 0) {
        const base64 = Buffer.from(q.image).toString('base64');
        q.imageBase64 = `data:image/jpeg;base64,${base64}`;
      } else {
        q.imageBase64 = null;
      }

      
      const [answers] = await db.query(`
  SELECT 
    a.id, 
    a.answer_text, 
    a.image,
    r.user_id, 
    u.name AS user_name, 
    u.email AS user_email, 
    q.type
  FROM answers a
  JOIN responses r ON a.response_id = r.id
  LEFT JOIN users u ON r.user_id = u.id
  JOIN questions q ON a.question_id = q.id
  WHERE a.question_id = ?
  ORDER BY r.submitted_at ASC
`, [q.id]);


for (let a of answers) {
  if (a.image && a.image.length > 0) {
    const base64 = Buffer.from(a.image).toString('base64');
    a.imageBase64 = `data:image/jpeg;base64,${base64}`;
  } else {
    a.imageBase64 = null;
  }

  
  if (q.type === 'single_choice' || q.type === 'multiple_choice') {
    const [opts] = await db.query(`
      SELECT o.text
      FROM answer_options ao
      JOIN options o ON ao.option_id = o.id
      WHERE ao.answer_id = ?
    `, [a.id]);
    a.selectedOptionTexts = opts.map(o => o.text);
  } else {
    a.selectedOptionTexts = [];
  }
}

      q.answers = answers;
    }

    res.json({ form_id: formId, questions });
  } catch (err) {
    console.error('Greška pri učitavanju grupnih odgovora:', err);
    res.status(500).json({
      message: 'Greška pri učitavanju grupnih odgovora',
      details: err.message
    });
  }
});

app.listen(3002, () => console.log('Server running on port 3002'));