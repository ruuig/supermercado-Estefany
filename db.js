require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

// Forzar UTF-8 en cada conexión
pool.on('connect', (client) => {
  client.query("SET client_encoding = 'UTF8'");
});

module.exports = pool;