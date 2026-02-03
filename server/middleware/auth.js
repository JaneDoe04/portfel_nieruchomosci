import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  if (!token) {
    return res.status(401).json({ message: 'Brak autoryzacji. Zaloguj się.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Użytkownik nie istnieje.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Nieprawidłowy lub wygasły token.' });
  }
};
