const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'forms_user',
  password: 'forms123',
  database: 'forms_app'
});

module.exports = pool;