const supabase = require("../config/supabase");

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ status: false, message: "Email dan Password wajib diisi!" });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({
        status: false,
        message: "Login Gagal: Email atau Password salah.",
      });
    }

    const user = data.user;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return res.status(200).json({
      status: true,
      message: "Login Berhasil!",
      data: {
        token: data.session.access_token,
        user: {
          id: user.id,
          email: user.email,
          full_name: profile?.full_name,
          username: profile?.username,
          role: profile?.role || "pelanggan",
          depot_id: profile?.depot_id,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      await supabase.auth.admin.signOut(token);
    }
    return res.status(200).json({
      status: true,
      message: "Logout Berhasil.",
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

exports.registerCustomer = async (req, res) => {
  const { email, password, full_name, username, phone_number } = req.body;

  if (!email || !password || !full_name) {
    return res
      .status(400)
      .json({ status: false, message: "Data wajib tidak lengkap!" });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, username, phone_number, role: "pelanggan" },
      },
    });

    if (error) throw error;

    return res.status(201).json({
      status: true,
      message: "Registrasi Berhasil! Silakan Login.",
      data: { id: data.user.id, email: data.user.email },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
