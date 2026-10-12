const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pharmacy_db',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,      // DATE / TIMESTAMP come back as plain strings
  decimalNumbers: true,   // DECIMAL / SUM() come back as numbers, not strings
});

module.exports = pool;
