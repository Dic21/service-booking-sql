const mysql = require('mysql2');
require('dotenv').config();
let pool = null;

pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: 'service_booking'
}).promise();

exports.pool = pool;