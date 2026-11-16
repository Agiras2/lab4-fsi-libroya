import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Genera un JWT firmado para el usuario dado.
 */
function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

/**
 * POST /api/auth/register
 * Crea un usuario con rol 'cliente' (el rol lo asigna el servidor).
 */
export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const user = new User({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: password, // el pre-save hook hace el hash
      role: 'cliente',        // siempre; el navegador no puede cambiar esto
    });

    await user.save();

    const token = signToken(user);
    return res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }

    // Incluimos passwordHash explícitamente porque está excluido por select: false
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = signToken(user);
    // Devolvemos el usuario sin passwordHash (toJSON lo elimina)
    return res.json({ token, user });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Devuelve los datos del usuario autenticado (sin passwordHash).
 */
export async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.json({ user });
  } catch (err) {
    next(err);
  }
}

