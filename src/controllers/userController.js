const supabase = require("../config/supabase");

exports.getMyProfile = async (req, res) => {
  const { id } = req.user; 

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, depots(name)")
      .eq("id", id)
      .single();

    if (error) throw error;

    return res.status(200).json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateMyProfile = async (req, res) => {
  const { id } = req.user;
  const { full_name, phone_number, username } = req.body;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name, phone_number, username })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      status: true,
      message: "Profil berhasil diperbarui",
      data,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// --- ADMIN FEATURES: MANAJEMEN PEGAWAI ---
exports.getEmployees = async (req, res) => {
  const { depot_id, role } = req.query;

  try {
    let query = supabase.from("profiles").select("*, depots(name)");

    if (depot_id && depot_id !== "all") {
      query = query.eq("depot_id", depot_id);
    }

    if (role && role !== "all") {  
      query = query.eq("role", role);
    } else {
      query = query.in("role", ["admin", "owner", "kasir", "pelayan"]);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.createEmployee = async (req, res) => {
  const { email, password, full_name, username, phone_number, role, depot_id } =
    req.body;

  if (!email || !password || !role || !depot_id) {
    return res.status(400).json({
      status: false,
      message: "Email, Password, dan Depot ID wajib diisi",
    });
  }

  if (role === "pelanggan") {
    return res.status(400).json({ status: false, message: "Akses ditolak: Gunakan endpoint pelanggan." });
  }

  try {
    if (role === "owner") {
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("depot_id", depot_id)
        .eq("role", "owner");

      if (countError) throw countError;
      if (count > 0) {
        return res.status(400).json({ status: false, message: "Gagal! Cabang ini sudah memiliki Owner. Satu cabang hanya boleh memiliki maksimal 1 Owner." });
      }
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, username, phone_number },
      },
    });

    if (authError) throw authError;

    if (!authData.user) {
      return res.status(400).json({ message: "Gagal membuat user auth" });
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .update({ role, depot_id })
      .eq("id", authData.user.id)
      .select()
      .single();

    if (profileError) throw profileError;

    return res.status(201).json({
      status: true,
      message: `Berhasil mendaftarkan ${role}`,
      data: profileData,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  const { id } = req.params;
  const { full_name, username, phone_number, role, depot_id } = req.body;

  try {
    if (role === "owner") {
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("depot_id", depot_id)
        .eq("role", "owner")
        .neq("id", id);

      if (countError) throw countError;
      if (count > 0) {
        return res.status(400).json({ status: false, message: "Gagal! Cabang ini sudah memiliki Owner lain." });
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name, username, phone_number, role, depot_id })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      status: true,
      message: "Data pegawai berhasil diperbarui!",
      data,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  const { id } = req.params;

  try {
    // delete user dari profile.. bukan dari auth supabase
    const { error } = await supabase.from("profiles").delete().eq("id", id);

    if (error) throw error;

    return res.status(200).json({
      status: true,
      message: "Data pegawai berhasil dihapus",
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// --- ADMIN FEATURES: MANAJEMEN Customer ---
exports.getCustomers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, phone_number, email, created_at")
      .eq("role", "pelanggan")
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.createCustomer = async (req, res) => {
  const { full_name, username, phone_number, email } = req.body;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .insert([
        { 
          full_name, 
          username, 
          phone_number, 
          email, 
          role: "pelanggan", 
          depot_id: null
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ status: true, message: "Pelanggan berhasil ditambahkan!", data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { full_name, username, phone_number, email } = req.body;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name, username, phone_number, email })
      .eq("id", id)
      .eq("role", "pelanggan")
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ status: true, message: "Data pelanggan berhasil diperbarui!", data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id)
      .eq("role", "pelanggan");

    if (error) throw error;
    return res.status(200).json({ status: true, message: "Akun pelanggan berhasil dihapus!" });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};