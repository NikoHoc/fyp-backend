const supabase = require("../config/supabase");

exports.getTables = async (req, res) => {
  const { depot_id } = req.params;

  try {
    const { data, error } = await supabase
      .from("tables")
      .select("*")
      .eq("depot_id", depot_id)
      .order("table_number", { ascending: true });

    if (error) throw error;
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.getTableById = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("tables")
      .select("id, table_number, is_active")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ status: false, message: "Meja tidak ditemukan" });

    return res.status(200).json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.createTable = async (req, res) => {
  const { depot_id, table_number } = req.body;

  if (!depot_id || !table_number) {
    return res.status(400).json({
      status: false,
      message: "Depot ID dan Nomor Meja wajib diisi",
    });
  }

  try {
    const { data: existing } = await supabase
      .from("tables")
      .select("id")
      .eq("depot_id", depot_id)
      .eq("table_number", table_number)
      .single();

    if (existing) {
      return res.status(409).json({
        status: false,
        message: `Meja nomor ${table_number} sudah ada di depot ini!`,
      });
    }

    const { data, error } = await supabase
      .from('tables')
      .insert([{ 
        depot_id: parseInt(depot_id), 
        table_number: table_number.trim(), 
        is_active: true
      }])
      .select();

    if (error) throw error;

    return res.status(201).json({
      status: true,
      message: "Meja berhasil ditambahkan",
      data,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { table_number, is_active } = req.body;

    const updateData = {};
    if (table_number !== undefined) updateData.table_number = table_number.trim();
    if (is_active !== undefined) updateData.is_active = is_active;
    const { data, error } = await supabase
      .from('tables')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Data meja tidak ditemukan' });
    }

    return res.status(200).json({ status: 'success', data: data[0] });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.deleteTable = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from("tables").delete().eq("id", id);

    if (error) throw error;

    return res.status(200).json({
      status: true,
      message: "Meja berhasil dihapus",
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
