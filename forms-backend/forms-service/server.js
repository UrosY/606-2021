const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const SECRET = 'tajna_lozinka';


// JWT MIDDLEWARE
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


// SLANJE ODGOVORA
app.post('/form/:id/submit', optionalVerifyToken, async (req, res) => {
  try {
    const formId = req.params.id;
    const payload = req.body;

    const [[formRow]] = await db.query('SELECT id, allow_anonymous, is_locked FROM forms WHERE id = ?', [formId]);
    if (!formRow) return res.status(404).json({ error: 'Forma nije pronađena' });
    if (formRow.is_locked) return res.status(403).json({ error: 'Forma je zaključana' });
    if (!formRow.allow_anonymous && !req.user) return res.status(401).json({ error: 'Morate biti prijavljeni da popunite ovu formu' });

    const userId = req.user ? req.user.id : null;
    const [respResult] = await db.query('INSERT INTO responses (form_id, user_id) VALUES (?, ?)', [formId, userId]);
    const responseId = respResult.insertId;

    if (Array.isArray(payload.answers)) {
      for (let a of payload.answers) {
        const qId = a.questionId;
        const qType = a.type;

        if (qType === 'multiple_choice') {
          const [ansRes] = await db.query(
            'INSERT INTO answers (response_id, question_id, answer_text) VALUES (?, ?, ?)',
            [responseId, qId, null]
          );
          const answerId = ansRes.insertId;
          if (Array.isArray(a.selectedOptionIds)) {
            for (let optId of a.selectedOptionIds) {
              await db.query(
                'INSERT INTO answer_options (answer_id, option_id) VALUES (?, ?)',
                [answerId, optId]
              );
            }
          }
        } else if (qType === 'single_choice') {
          const val = a.selectedOptionId ? String(a.selectedOptionId) : null;
          await db.query(
            'INSERT INTO answers (response_id, question_id, answer_text) VALUES (?, ?, ?)',
            [responseId, qId, val]
          );
        } else {
          const val = (a.value !== undefined && a.value !== null) ? String(a.value) : null;
          await db.query(
            'INSERT INTO answers (response_id, question_id, answer_text) VALUES (?, ?, ?)',
            [responseId, qId, val]
          );
        }
      }
    }

    res.json({ success: true, message: 'Odgovori su uspešno poslati' });
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


// BRISANJE FORME
app.delete("/forms/:id", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Nedostaje token." });
  }

  const token = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, SECRET); 
  } catch (err) {
    return res.status(403).json({ message: "Neispravan token." });
  }

  const userId = decoded.id; 
  const formId = req.params.id;

  try {
    const [form] = await db.query(
      "SELECT * FROM forms WHERE id = ? AND owner_id = ?",
      [formId, userId]
    );

    if (form.length === 0) {
      return res.status(403).json({ message: "Ne možete da obrišete ovu formu jer niste njen kreator." });
    }

    await db.query(
      "DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE form_id = ?)",
      [formId]
    );
    await db.query("DELETE FROM questions WHERE form_id = ?", [formId]);
    await db.query("DELETE FROM forms WHERE id = ?", [formId]);

    res.json({ message: "Forma i sva njena pitanja su uspešno obrisani." });
  } catch (err) {
    console.error("Greška pri brisanju forme:", err);
    res.status(500).json({ message: "Greška pri brisanju forme." });
  }
});


// LISTA REZULTATA (FORME I ODGOVORI)
app.get('/my-results', requireToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [forms] = await db.query(
      'SELECT id, title, description FROM forms WHERE owner_id = ?',
      [userId]
    );

    const results = [];

    for (const form of forms) {
      const [responses] = await db.query(`
        SELECT r.id AS response_id,
               r.submitted_at,
               u.name AS user_name,
               u.email AS user_email,
               f.title AS form_title
        FROM responses r
        LEFT JOIN users u ON r.user_id = u.id
        JOIN forms f ON r.form_id = f.id
        WHERE r.form_id = ?
        ORDER BY r.submitted_at DESC
      `, [form.id]);

      results.push({ form_id: form.id, title: form.title, description: form.description, responses });
    }

    res.json(results);
  } catch (err) {
    console.error('Greška pri učitavanju rezultata:', err);
    res.status(500).json({ message: 'Greška pri učitavanju rezultata', details: err.message });
  }
});


// POGLEDAJ JEDAN ODGOVOR SA PITANJIMA
app.get('/response/:id', requireToken, async (req, res) => {
  try {
    const responseId = req.params.id;

    const [[respRow]] = await db.query(`
      SELECT r.id AS response_id, r.form_id, r.user_id, r.submitted_at, f.title AS form_title
      FROM responses r
      JOIN forms f ON r.form_id = f.id
      WHERE r.id = ?
    `, [responseId]);

    if (!respRow) return res.status(404).json({ message: 'Odgovor nije pronađen' });

    
    const [[formCheck]] = await db.query('SELECT owner_id FROM forms WHERE id = ?', [respRow.form_id]);
    if (formCheck.owner_id !== req.user.id) return res.status(403).json({ message: 'Nemate pristup ovom odgovoru' });

    const [questions] = await db.query(
      'SELECT id, text, type, is_required FROM questions WHERE form_id = ? ORDER BY position ASC',
      [respRow.form_id]
    );

    for (let q of questions) {
      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        const [opts] = await db.query('SELECT id, text FROM options WHERE question_id = ? ORDER BY id ASC', [q.id]);
        q.options = opts;

        if (q.type === 'single_choice') {
          const [[ans]] = await db.query('SELECT answer_text FROM answers WHERE question_id = ? AND response_id = ?', [q.id, responseId]);
          q.answer = ans ? ans.answer_text : null;
        } else {
          const [ansOpts] = await db.query(`
            SELECT ao.option_id 
            FROM answer_options ao
            JOIN answers a ON ao.answer_id = a.id
            WHERE a.question_id = ? AND a.response_id = ?
          `, [q.id, responseId]);
          q.answer = ansOpts.map(o => o.option_id);
        }
      } else {
        const [[ans]] = await db.query('SELECT answer_text FROM answers WHERE question_id = ? AND response_id = ?', [q.id, responseId]);
        q.answer = ans ? ans.answer_text : null;
      }
    }

    res.json({ response: respRow, questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greška pri učitavanju odgovora', details: err.message });
  }
});
const ExcelJS = require('exceljs'); 


// EXPORT JEDAN ODGOVOR U XLSX
app.get('/form/:responseId/export', requireToken, async (req, res) => {
  try {
    const responseId = req.params.responseId;

    
    const [[respRow]] = await db.query(`
      SELECT r.id AS response_id, r.form_id, r.user_id, r.submitted_at, f.title AS form_title
      FROM responses r
      JOIN forms f ON r.form_id = f.id
      WHERE r.id = ?
    `, [responseId]);

    if (!respRow) return res.status(404).json({ message: 'Odgovor nije pronađen' });

    const [[formCheck]] = await db.query('SELECT owner_id FROM forms WHERE id = ?', [respRow.form_id]);
    if (formCheck.owner_id !== req.user.id) return res.status(403).json({ message: 'Nemate pristup ovom odgovoru' });

    const [questions] = await db.query(
      'SELECT id, text, type FROM questions WHERE form_id = ? ORDER BY position ASC',
      [respRow.form_id]
    );

   
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Odgovori');

    sheet.columns = [
      { header: 'Pitanje', key: 'question', width: 50 },
      { header: 'Odgovor', key: 'answer', width: 50 }
    ];

    for (let q of questions) {
      let answerText = '';
      if (q.type === 'single_choice') {
        const [[ans]] = await db.query('SELECT answer_text FROM answers WHERE question_id = ? AND response_id = ?', [q.id, responseId]);
        answerText = ans ? ans.answer_text : '';
      } else if (q.type === 'multiple_choice') {
        const [ansOpts] = await db.query(`
          SELECT ao.option_id, o.text AS option_text
          FROM answer_options ao
          JOIN answers a ON ao.answer_id = a.id
          JOIN options o ON ao.option_id = o.id
          WHERE a.question_id = ? AND a.response_id = ?
        `, [q.id, responseId]);
        answerText = ansOpts.map(o => o.option_text).join(', ');
      } else {
        const [[ans]] = await db.query('SELECT answer_text FROM answers WHERE question_id = ? AND response_id = ?', [q.id, responseId]);
        answerText = ans ? ans.answer_text : '';
      }

      sheet.addRow({ question: q.text, answer: answerText });
    }

    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rezultati_forme_${responseId}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greška pri eksportu XLSX fajla', details: err.message });
  }
});

// GRUPNI ODGOVORI ZA FORMU
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
      'SELECT id, text, type FROM questions WHERE form_id = ? ORDER BY position ASC',
      [formId]
    );

    
    for (let q of questions) {
      const [answers] = await db.query(`
        SELECT a.id, a.answer_text, r.user_id, u.name AS user_name, u.email AS user_email, q.type
        FROM answers a
        JOIN responses r ON a.response_id = r.id
        LEFT JOIN users u ON r.user_id = u.id
        JOIN questions q ON a.question_id = q.id
        WHERE a.question_id = ?
        ORDER BY r.submitted_at ASC
      `, [q.id]);

      
      for (let a of answers) {
        if (q.type === 'single_choice' || q.type === 'multiple_choice') {
          const [opts] = await db.query(`
            SELECT o.text
            FROM answer_options ao
            JOIN options o ON ao.option_id = o.id
            WHERE ao.answer_id = ?
          `, [a.id]);
          a.selectedOptionTexts = opts.map(o => o.text);
        }
      }

      q.answers = answers;
    }

    res.json({ form_id: formId, questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greška pri učitavanju grupnih odgovora', details: err.message });
  }
});

app.get('/public-forms', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, title, description FROM forms WHERE allow_anonymous = 1'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greška pri učitavanju javnih formi' });
  }
});




app.listen(3002, () => console.log('Forms service running on port 3002'));