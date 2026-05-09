require('dotenv').config({ path: '../.env' });
const pool = require('../config/db');

async function check() {
    try {
        const res = await pool.query('SELECT id, email, business_name FROM users WHERE email = $1', ['iris.dev25@gmail.com']);
        if (res.rows.length > 0) {
            console.log('USUARIO ENCONTRADO:', res.rows[0]);
        } else {
            console.log('USUARIO NO ENCONTRADO. Debes registrarte primero en la web.');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}
check();
