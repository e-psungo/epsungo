function ensureAuthenticated(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function ensureAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  next();
}

module.exports = { ensureAuthenticated, ensureAdmin };
