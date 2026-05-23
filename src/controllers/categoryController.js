const supabase = require("../config/supabase");

exports.getCategories = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.createCategory = async (req, res) => {
  const { name, type } = req.body;

  if (!name) {
    return res.status(400).json({
      status: false,
      message: "Nama Kategori wajib diisi",
    });
  }

  try {
    const { data, error } = await supabase
      .from("categories")
      .insert([
        { 
          name, 
          type: type || 'food' 
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      status: true,
      message: "Kategori berhasil dibuat",
      data,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, type } = req.body;

  if (!name) {
    return res.status(400).json({ status: false, message: "Nama kategori tidak boleh kosong" });
  }
  
  try {
    const updateData = {};
    if (name) updateData.name = name;
    if (type) updateData.type = type;

    const { data, error } = await supabase
      .from("categories")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    return res.status(200).json({
      status: true,
      message: "Kategori berhasil diperbarui",
      data,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) throw error;

    return res.status(200).json({
      status: true,
      message: "Kategori berhasil dihapus",
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
