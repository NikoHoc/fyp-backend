const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        status: false,
        message: `Akses Terlarang! Fitur ini hanya untuk: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
};

module.exports = roleMiddleware;
