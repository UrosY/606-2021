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
    const { title, description, allowGuests, questions, imageIndices } = JSON.parse(req.body.data);
    if (!title || title.trim() === '') return res.status(400).json({ message: 'Naziv forme je obavezan!' });

    const [formResult] = await db.query(
      'INSERT INTO forms (title, description, allow_anonymous, owner_id) VALUES (?, ?, ?, ?)',
      [title.trim(), description || '', allowGuests ? 1 : 0, req.user.id]
    );
    const formId = formResult.insertId;

    
    const imageMap = {};
    if (Array.isArray(imageIndices)) {
      imageIndices.forEach((qIndex, fileIndex) => {
        imageMap[qIndex] = fileIndex;
      });
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text) continue;

      let imageData = Buffer.alloc(0); 

      
      if (imageMap.hasOwnProperty(i) && req.files && req.files[imageMap[i]]) {
        imageData = req.files[imageMap[i]].buffer;
      }

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
    
    const payload = req.body.data ? JSON.parse(req.body.data) : req.body; 

    const [[formRow]] = await db.query('SELECT id, allow_anonymous, is_locked FROM forms WHERE id = ?', [formId]);
    if (!formRow) return res.status(404).json({ error: 'Forma nije pronađena' });
    if (formRow.is_locked) return res.status(403).json({ error: 'Forma je zaključana' });
    if (!formRow.allow_anonymous && !req.user) return res.status(401).json({ error: 'Morate biti prijavljeni da popunite ovu formu' });

    const userId = req.user ? req.user.id : null;

    
    const [questions] = await db.query(
      'SELECT id, text, type, is_required FROM questions WHERE form_id = ?',
      [formId]
    );

    const questionMap = {};
    questions.forEach(q => { questionMap[q.id] = q; });

    
    const submissions = payload.responses || payload.answers || [];

    if (!Array.isArray(submissions)) {
      return res.status(400).json({ message: 'Responses must be an array' });
    }

    let fileIndex = 0;

    
    for (let submission of submissions) {
      const qId = submission.questionId;
      const question = questionMap[qId];

      if (!question) {
        return res.status(400).json({ message: `Question ${qId} not found` });
      }

      const qType = question.type;
      let answer = submission.answer !== undefined ? submission.answer : submission.value;

      
      if (qType === 'short_text' && answer) {
        if (String(answer).length > 512) {
          return res.status(400).json({ message: 'Short text answer exceeds 512 character limit' });
        }
      }

      if (qType === 'long_text' && answer) {
        if (String(answer).length > 4096) {
          return res.status(400).json({ message: 'Long text answer exceeds 4096 character limit' });
        }
      }

      let imageData = Buffer.alloc(0);
      if (req.files && req.files[fileIndex]) {
        imageData = req.files[fileIndex].buffer;
        fileIndex++;
      }

      let answerText = null;
      let selectedOptionIds = [];

      
      if (['short_text', 'long_text', 'date', 'time'].includes(qType)) {
        answerText = answer ? String(answer) : null;
      } else if (qType === 'numeric') {
        answerText = answer !== null && answer !== undefined ? String(answer) : null;
      } else if (qType === 'single_choice') {
        if (Array.isArray(answer)) {
          return res.status(400).json({ message: 'Single choice question cannot have multiple answers' });
        }
        
        if (typeof answer === 'string') {
          const [opts] = await db.query(
            'SELECT id FROM options WHERE question_id = ? AND text = ?',
            [qId, answer]
          );
          if (opts.length > 0) {
            answerText = String(opts[0].id);
          }
        } else if (typeof answer === 'number') {
          answerText = String(answer);
        } else if (submission.selectedOptionId) {
          answerText = String(submission.selectedOptionId);
        }
      } else if (qType === 'multiple_choice') {
        if (!Array.isArray(answer)) {
          answer = [answer];
        }

        
        for (let optText of answer) {
          const [opts] = await db.query(
            'SELECT id FROM options WHERE question_id = ? AND text = ?',
            [qId, optText]
          );
          if (opts.length > 0) {
            selectedOptionIds.push(opts[0].id);
          }
        }

        
        const minMatch = question.text.match(/choose (\d+)/i);
        if (minMatch && selectedOptionIds.length < parseInt(minMatch[1])) {
          return res.status(400).json({ message: `You must select at least ${minMatch[1]} options for "${question.text}"` });
        }
      }

      
      if (qType === 'date' && answerText) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(answerText)) {
          return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
        }
      }

      
      if (qType === 'time' && answerText) {
        if (!/^\d{2}:\d{2}$/.test(answerText)) {
          return res.status(400).json({ message: 'Invalid time format. Use HH:MM' });
        }
      }
    }

    
    const requiredQuestions = questions.filter(q => q.is_required);
    const answeredQuestionIds = submissions.map(s => s.questionId);

    for (let req of requiredQuestions) {
      if (!answeredQuestionIds.includes(req.id)) {
        return res.status(400).json({ message: `Required question "${req.text}" must be answered` });
      }
    }

    
    const [respResult] = await db.query('INSERT INTO responses (form_id, user_id) VALUES (?, ?)', [formId, userId]);
    const responseId = respResult.insertId;

    
    fileIndex = 0;
    for (let submission of submissions) {
      const qId = submission.questionId;
      const question = questionMap[qId];
      const qType = question.type;
      let answer = submission.answer !== undefined ? submission.answer : submission.value;

      let imageData = Buffer.alloc(0);
      if (req.files && req.files[fileIndex]) {
        imageData = req.files[fileIndex].buffer;
        fileIndex++;
      }

      let answerText = null;
      let selectedOptionIds = [];

      
      if (['short_text', 'long_text', 'date', 'time'].includes(qType)) {
        answerText = answer ? String(answer) : null;
      } else if (qType === 'numeric') {
        answerText = answer !== null && answer !== undefined ? String(answer) : null;
      } else if (qType === 'single_choice') {
        
        if (typeof answer === 'string') {
          const [opts] = await db.query(
            'SELECT id FROM options WHERE question_id = ? AND text = ?',
            [qId, answer]
          );
          if (opts.length > 0) {
            answerText = String(opts[0].id);
          }
        } else if (typeof answer === 'number') {
          answerText = String(answer);
        } else if (submission.selectedOptionId) {
          answerText = String(submission.selectedOptionId);
        }
      } else if (qType === 'multiple_choice') {
        if (!Array.isArray(answer)) {
          answer = [answer];
        }
        
        for (let optText of answer) {
          const [opts] = await db.query(
            'SELECT id FROM options WHERE question_id = ? AND text = ?',
            [qId, optText]
          );
          if (opts.length > 0) {
            selectedOptionIds.push(opts[0].id);
          }
        }
      }

      const [ansRes] = await db.query(
        'INSERT INTO answers (response_id, question_id, answer_text, image) VALUES (?, ?, ?, ?)',
        [responseId, qId, answerText, imageData]
      );
      const answerId = ansRes.insertId;

      if (qType === 'multiple_choice' && selectedOptionIds.length > 0) {
        for (let optId of selectedOptionIds) {
          await db.query('INSERT INTO answer_options (answer_id, option_id) VALUES (?, ?)', [answerId, optId]);
        }
      }
    }

    // Return the response with all answers for testing
    const [savedAnswers] = await db.query(
      'SELECT id, question_id, answer_text FROM answers WHERE response_id = ?',
      [responseId]
    );

    res.json({
      id: responseId,
      success: true,
      message: 'Odgovori su uspešno poslati sa slikama',
      responses: savedAnswers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška pri slanju odgovora', details: err.message });
  }
});

// HELPER: Check user's role on a form (owner, editor, viewer, or null)
async function getUserFormRole(formId, userId) {
  const [[form]] = await db.query('SELECT owner_id FROM forms WHERE id = ?', [formId]);
  if (!form) return null;
  if (form.owner_id === userId) return 'owner';

  const [[collab]] = await db.query('SELECT role FROM collaborators WHERE form_id = ? AND user_id = ?', [formId, userId]);
  return collab ? collab.role : null;
}

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

    const [users] = await db.query('SELECT id, name FROM users WHERE email = ?', [email]);
    if (!users.length) return res.status(404).json({ message: 'Korisnik nije pronađen.' });
    const userId = users[0].id;

    if (userId === req.user.id) return res.status(400).json({ message: 'Ne možete dodati sebe kao kolaboratora.' });

    const [existing] = await db.query('SELECT id FROM collaborators WHERE form_id = ? AND user_id = ?', [formId, userId]);
    if (existing.length) return res.status(400).json({ message: 'Korisnik je već kolaborator.' });

    await db.query('INSERT INTO collaborators (form_id, user_id, role) VALUES (?, ?, ?)', [formId, userId, role]);
    res.json({ success: true, message: 'Kolaborator dodat.', collaborator: { email, name: users[0].name, role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greška pri dodavanju kolaboratora.', details: err.message });
  }
});

// LISTA KOLABORATORA
app.get('/forms/:id/collaborators', requireToken, async (req, res) => {
  try {
    const formId = req.params.id;
    const userRole = await getUserFormRole(formId, req.user.id);

    if (!userRole) return res.status(403).json({ message: 'Nemate pristup ovoj formi.' });

    const [collaborators] = await db.query(`
      SELECT c.id, c.role, u.name, u.email
      FROM collaborators c
      JOIN users u ON c.user_id = u.id
      WHERE c.form_id = ?
      ORDER BY c.role, u.name
    `, [formId]);

    res.json({
      collaborators,
      isOwner: userRole === 'owner',
      userRole: userRole 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greška pri učitavanju kolaboratora.', details: err.message });
  }
});

// BRISANJE KOLABORATORA
app.delete('/forms/:id/collaborators/:collabId', requireToken, async (req, res) => {
  try {
    const formId = req.params.id;
    const collabId = req.params.collabId;

    const [[form]] = await db.query('SELECT owner_id FROM forms WHERE id = ?', [formId]);
    if (!form) return res.status(404).json({ message: 'Forma nije pronađena.' });
    if (form.owner_id !== req.user.id) return res.status(403).json({ message: 'Samo vlasnik može ukloniti kolaboratore.' });

    const [result] = await db.query('DELETE FROM collaborators WHERE id = ? AND form_id = ?', [collabId, formId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Kolaborator nije pronađen.' });

    res.json({ success: true, message: 'Kolaborator uklonjen.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greška pri uklanjanju kolaboratora.', details: err.message });
  }
});

// PROMENA REDOSLEDA PITANJA (owner and editors can reorder)
app.post('/form/:id/reorder', requireToken, async (req, res) => {
  try {
    const formId = req.params.id;
    const { questionOrder } = req.body;
    if (!Array.isArray(questionOrder)) return res.status(400).json({ error: 'questionOrder mora biti niz' });

    
    const userRole = await getUserFormRole(formId, req.user.id);
    if (!userRole) return res.status(404).json({ error: 'Forma nije pronađena' });
    if (userRole !== 'owner' && userRole !== 'editor') return res.status(403).json({ error: 'Nemate dozvolu za izmenu ove forme' });

    for (let i = 0; i < questionOrder.length; i++) {
      await db.query('UPDATE questions SET position = ? WHERE id = ? AND form_id = ?', [i + 1, questionOrder[i], formId]);
    }

    res.json({ success: true, message: 'Redosled pitanja ažuriran' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška pri ažuriranju redosleda', details: err.message });
  }
});

// ZAKLJUCAVANJE/OTKLJUCAVANJE FORME (owner and editors can lock/unlock)
app.patch('/forms/:id/lock', requireToken, async (req, res) => {
  try {
    const formId = req.params.id;
    const { isLocked } = req.body;

    if (typeof isLocked !== 'boolean') return res.status(400).json({ message: 'isLocked mora biti boolean' });

    
    const userRole = await getUserFormRole(formId, req.user.id);
    if (!userRole) return res.status(404).json({ message: 'Forma nije pronađena' });
    if (userRole !== 'owner' && userRole !== 'editor') return res.status(403).json({ message: 'Nemate dozvolu za zaključavanje ove forme' });

    await db.query('UPDATE forms SET is_locked = ? WHERE id = ?', [isLocked ? 1 : 0, formId]);
    res.json({ success: true, message: isLocked ? 'Forma zaključana' : 'Forma otključana' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Greška pri zaključavanju forme', details: err.message });
  }
});

// IZMENA FORME
app.put('/edit-form/:id', requireToken, upload.array('images'), async (req, res) => {
  try {
    const formId = req.params.id;
    const { title, description, allowGuests, questions, imageIndices } = JSON.parse(req.body.data);

    
    const userRole = await getUserFormRole(formId, req.user.id);
    if (!userRole) return res.status(404).json({ error: 'Forma nije pronađena' });
    if (userRole !== 'owner' && userRole !== 'editor') return res.status(403).json({ error: 'Nemate dozvolu za izmenu ove forme' });

    await db.query("UPDATE forms SET title = ?, description = ?, allow_anonymous = ? WHERE id = ?", [title, description, allowGuests ? 1 : 0, formId]);

    
    const [existingQuestions] = await db.query(
      'SELECT id, image FROM questions WHERE form_id = ?',
      [formId]
    );

    
    const existingImageMap = {};
    existingQuestions.forEach(eq => {
      if (eq.image && eq.image.length > 0) {
        existingImageMap[eq.id] = eq.image;
      }
    });

    await db.query("DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE form_id = ?)", [formId]);
    await db.query("DELETE FROM questions WHERE form_id = ?", [formId]);

    
    const imageMap = {};
    if (Array.isArray(imageIndices)) {
      imageIndices.forEach((qIndex, fileIndex) => {
        imageMap[qIndex] = fileIndex;
      });
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      let imageData = Buffer.alloc(0); 

      
      if (imageMap.hasOwnProperty(i) && req.files && req.files[imageMap[i]]) {
        imageData = req.files[imageMap[i]].buffer;
      }
      
      else if (q.hasExistingImage && q.id && existingImageMap[q.id]) {
        imageData = existingImageMap[q.id];
      }

      const [result] = await db.query(
        "INSERT INTO questions (form_id, text, type, is_required, position, image) VALUES (?, ?, ?, ?, ?, ?)",
        [formId, q.text, q.type, q.required ? 1 : 0, i + 1, imageData]
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

// LISTA REZULTATA (owner and all collaborators can view)
app.get('/my-results', requireToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [forms] = await db.query(`
      SELECT DISTINCT f.id, f.title, f.description
      FROM forms f
      LEFT JOIN collaborators c ON f.id = c.form_id
      WHERE f.owner_id = ? OR c.user_id = ?
    `, [userId, userId]);

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
        q.image AS question_image,
        a.answer_text AS answer,
        a.image AS answer_image,
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
          questionImageBase64: null,
          answerImageBase64: null
        };

        
        if (row.question_image && row.question_image.length > 0) {
          const base64 = Buffer.from(row.question_image).toString('base64');
          grouped[row.question_id].questionImageBase64 = `data:image/jpeg;base64,${base64}`;
        }
      }

      
      if (row.answer_image && row.answer_image.length > 0) {
        const base64 = Buffer.from(row.answer_image).toString('base64');
        grouped[row.question_id].answerImageBase64 = `data:image/jpeg;base64,${base64}`;
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

    
    const userRole = await getUserFormRole(formId, req.user.id);
    if (!userRole) return res.status(403).json({ message: 'Nemate pristup ovoj formi' });

    
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
module.exports = app;
app.listen(3002, () => console.log('Server running on port 3002'));