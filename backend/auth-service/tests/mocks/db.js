let users = [];

module.exports = {
  query: jest.fn(async (sql, params) => {
    if (sql.startsWith('SELECT * FROM users WHERE email = ?')) {
      const user = users.find(u => u.email === params[0]);
      return [[user].filter(Boolean)]; // vraća [rows]
    }

    if (sql.startsWith('INSERT INTO users')) {
      const id = users.length + 1;
      const [name, email, password] = params;
      const newUser = { id, name, email, password };
      users.push(newUser);
      return [{ insertId: id }]; // MySQL insert result
    }

    if (sql.startsWith('DELETE FROM users')) {
      users = users.filter(u => u.email !== params[0]);
      return [{}]; // DELETE vraća prazan objekt
    }

    return [[]];
  }),
  end: jest.fn(async () => {}),
  __reset: () => { users = []; } // da resetuješ mock između testova
};