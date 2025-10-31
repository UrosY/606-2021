const request = require('supertest');
const app = require('../server'); 
const db = require('../db'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = 'tajna_lozinka';

let token;
let testUserId;
let testFormId;

beforeAll(async () => {
  
  await db.query('DELETE FROM forms WHERE title LIKE "TEST%"');
  await db.query('DELETE FROM users WHERE email = "testuser@example.com"');

  
  const hashedPassword = await bcrypt.hash('password123', 10);
  const [res] = await db.query(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    ['Test User', 'testuser@example.com', hashedPassword]
  );
  testUserId = res.insertId;

  
  token = jwt.sign({ id: testUserId, email: 'testuser@example.com' }, SECRET);
});

afterAll(async () => {
  await db.query('DELETE FROM forms WHERE title LIKE "TEST%"');
  await db.query('DELETE FROM users WHERE email = "testuser@example.com"');
  db.end();
});

describe('Forms Service Endpoints', () => {
  test('should create a new form', async () => {
    const res = await request(app)
      .post('/create-form')
      .set('Authorization', `Bearer ${token}`)
      .field('data', JSON.stringify({
        title: 'TEST Form 1',
        description: 'Test description',
        allowGuests: true,
        questions: [
          { text: 'Question 1', type: 'short_text', required: true, options: [] }
        ],
        imageIndices: []
      }));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    testFormId = res.body.formId;
  });

  test('should get my forms', async () => {
    const res = await request(app)
      .get('/my-forms')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(f => f.id === testFormId)).toBe(true);
  });

  test('should get a form with questions', async () => {
    const res = await request(app)
      .get(`/form/${testFormId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.form.id).toBe(testFormId);
    expect(Array.isArray(res.body.questions)).toBe(true);
  });

  test('should submit answers to form', async () => {
  
  const [questions] = await db.query('SELECT id FROM questions WHERE form_id = ? LIMIT 1', [testFormId]);
  expect(questions.length).toBeGreaterThan(0);
  const questionId = questions[0].id;

  const res = await request(app)
    .post(`/form/${testFormId}/submit`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      responses: [
        { questionId: questionId, answer: 'Answer to Q1' }
      ]
    });

  console.log('Submit form response:', res.body);

  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
});

  test('should get my results', async () => {
    const res = await request(app)
      .get('/my-results')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('should get a single response with questions', async () => {
    const [responses] = await db.query('SELECT id FROM responses WHERE form_id = ? LIMIT 1', [testFormId]);
    if (!responses.length) return;

    const responseId = responses[0].id;
    const res = await request(app)
      .get(`/response/${responseId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.response.id).toBe(responseId);
  });

  test('should add a collaborator', async () => {
  
  await db.query('DELETE FROM users WHERE email = "collab@example.com"');

  
  const [userRes] = await db.query(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    ['Collaborator', 'collab@example.com', await bcrypt.hash('password123', 10)]
  );
  const collabId = userRes.insertId;

  
  const res = await request(app)
    .post(`/forms/${testFormId}/collaborators`)
    .set('Authorization', `Bearer ${token}`)
    .send({ email: 'collab@example.com', role: 'editor' });

  console.log('Add collaborator response:', res.body);

  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
});

  test('should get collaborators', async () => {
    const res = await request(app)
      .get(`/forms/${testFormId}/collaborators`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.collaborators.length).toBeGreaterThan(0);
  });

  test('should reorder questions', async () => {
    const res = await request(app)
      .post(`/form/${testFormId}/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ questionOrder: [1] });

    expect(res.statusCode).toBe(200);
  });

  test('should lock and unlock form', async () => {
    let res = await request(app)
      .patch(`/forms/${testFormId}/lock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isLocked: true });

    expect(res.statusCode).toBe(200);

    res = await request(app)
      .patch(`/forms/${testFormId}/lock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isLocked: false });

    expect(res.statusCode).toBe(200);
  });

  test('should edit form', async () => {
    const res = await request(app)
      .put(`/edit-form/${testFormId}`)
      .set('Authorization', `Bearer ${token}`)
      .field('data', JSON.stringify({
        title: 'TEST Form Edited',
        description: 'Edited description',
        allowGuests: false,
        questions: [
          { text: 'Edited Q1', type: 'short_text', required: true, options: [] }
        ],
        imageIndices: []
      }));

    expect(res.statusCode).toBe(200);
  });

  test('should delete form', async () => {
    const res = await request(app)
      .delete(`/forms/${testFormId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });
});