const supabase = require("../config/supabase");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        status: false,
        message: "Akses Ditolak: Token tidak ditemukan.",
      });
    }

    const token = authHeader.split(" ")[1];

    const {data: { user }, error} = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        status: false,
        message: "Token tidak valid atau kadaluarsa.",
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, depot_id, full_name, username")
      .eq("id", user.id)
      .single();

    req.user = {
      id: user.id,
      email: user.email,
      role: profile?.role || "pelanggan",
      depot_id: profile?.depot_id || null,
      full_name: profile?.full_name || "",
    };

    next();
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Server Error pada Auth Middleware",
      error: err.message,
    });
  }
};

module.exports = authMiddleware;
