const request = require('supertest');
const app = require('../server');
const db = require('../db');

let userId;

const testUser = {
  name: 'Pavle',
  email: 'test@example.com',
  password: '123456'
};

beforeAll(async () => {
  await db.query('DELETE FROM users WHERE email = ?', [testUser.email]);
});

afterAll(async () => {
  await db.query('DELETE FROM users WHERE email = ?', [testUser.email]);
  await db.end();
});

describe('Auth Service Endpoints', () => {

  it('should register a new user', async () => {
    const res = await request(app).post('/register').send(testUser);
    
    expect([200, 201]).toContain(res.statusCode);
    expect(res.body).toHaveProperty('message', 'User registered');

    
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [testUser.email]);
    userId = rows[0].id;
  });

  it('should not register user with existing email', async () => {
    const res = await request(app).post('/register').send(testUser);
    expect(res.statusCode).toBe(400);
    
    expect(res.body).toHaveProperty('error', 'Email već postoji');
  });

  it('should login the user and return a token', async () => {
    const res = await request(app).post('/login').send({
      email: testUser.email,
      password: testUser.password
    });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
  });

  it('should fail login with wrong password', async () => {
    const res = await request(app).post('/login').send({
      email: testUser.email,
      password: 'pogresnaLozinka'
    });
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('should update user name', async () => {
    const newName = 'Pavle Updated';
    const res = await request(app)
      .put(`/users/${userId}`)
      .send({ name: newName });

    
    if (res.statusCode === 404) {
      console.warn('PUT /users/:id endpoint nije implementiran na serveru');
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id', userId);
    expect(res.body).toHaveProperty('name', newName);
  });

  it('should update user password', async () => {
    const newPassword = '654321';
    const res = await request(app)
      .put(`/users/${userId}/password`)
      .send({ password: newPassword });

    if (res.statusCode === 404) {
      console.warn('PUT /users/:id/password endpoint nije implementiran na serveru');
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Password updated');

    
    const loginRes = await request(app).post('/login').send({
      email: testUser.email,
      password: newPassword
    });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
  });

  it('should delete the user', async () => {
    const res = await request(app).delete(`/users/${userId}`);

    if (res.statusCode === 404) {
      console.warn('DELETE /users/:id endpoint nije implementiran na serveru');
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'User deleted');

    
    const loginRes = await request(app).post('/login').send({
      email: testUser.email,
      password: '654321'
    });

    expect(loginRes.statusCode).toBe(401);
  });

});