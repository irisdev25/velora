const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const crypto = require('crypto');
const { sendPasswordReset, sendWelcomeEmail, sendEmailVerification } = require('../config/emailService');

const register = async (req, res) => {
  try {
    const { name, business_name, email, password } = req.body;

    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generar token de verificación
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const newUser = await pool.query(
      'INSERT INTO users (name, business_name, email, password, email_verification_token, email_verified) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id, name, business_name, email',
      [name, business_name, email, hashedPassword, verificationToken]
    );

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no está definido en las variables de entorno');
    }

    const token = jwt.sign(
      { id: newUser.rows[0].id, email: newUser.rows[0].email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Enviar correos en background
    (async () => {
      try {
        await sendWelcomeEmail(email, { name, business_name });
        await sendEmailVerification(email, { name, verification_token: verificationToken });
      } catch (emailError) {
        console.error('Error al enviar correos de registro:', emailError);
      }
    })();

    res.status(201).json({ token, user: newUser.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor', error: error.message, stack: error.stack });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userRow = await pool.query(
      'SELECT id, name, business_name, email, password, email_verified FROM users WHERE email = $1',
      [email]
    );
    if (userRow.rows.length === 0) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, userRow.rows[0].password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no está definido en las variables de entorno');
    }

    const token = jwt.sign(
      { id: userRow.rows[0].id, email: userRow.rows[0].email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: userRow.rows[0].id,
        name: userRow.rows[0].name,
        business_name: userRow.rows[0].business_name,
        email: userRow.rows[0].email,
        email_verified: userRow.rows[0].email_verified,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor', error: error.message, stack: error.stack });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      'UPDATE users SET email_verified = TRUE, email_verification_token = NULL WHERE email_verification_token = $1 RETURNING id',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Token de verificación inválido o ya fue usado' });
    }

    res.json({ message: 'Correo verificado con éxito' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor', error: error.message, stack: error.stack });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    // Seguridad: siempre responder 200, no revelar si el correo existe
    if (user.rows.length === 0) {
      return res.json({ message: 'Si tu correo está registrado, recibirás un enlace de recuperación.' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 3600000);

    await pool.query(
      'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3',
      [token, expires, email]
    );

    await sendPasswordReset(email, token);
    res.json({ message: 'Correo de recuperación enviado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor', error: error.message, stack: error.stack });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await pool.query(
      'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
      [token]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ message: 'El token es inválido o ha expirado' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query(
      'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
      [hashedPassword, user.rows[0].id]
    );

    res.json({ message: 'Contraseña actualizada con éxito' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor', error: error.message, stack: error.stack });
  }
};

module.exports = { register, login, verifyEmail, forgotPassword, resetPassword };