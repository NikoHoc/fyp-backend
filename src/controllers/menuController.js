const supabase = require("../config/supabase");

exports.createMenu = async (req, res) => {
  try {
    const { name, price, half_price, category_id, description } = req.body;
    const file = req.file;

    if (!name || !price || !category_id) {
      return res.status(400).json({ 
        status: false, 
        message: "Data tidak lengkap (Nama, Harga, Kategori)!" 
      });
    }

    let image_url = null;

    if (file) {
      const fileExt = file.originalname.split(".").pop();
      const fileName = `${Date.now()}_${name.replace(/\s/g, "")}.${fileExt}`;
      const filePath = `menus/${fileName}`; 

      const { error: uploadError } = await supabase.storage
        .from("ta01-bucket")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("ta01-bucket")
        .getPublicUrl(filePath);

      image_url = publicUrlData.publicUrl;
    }

    const { data, error } = await supabase
      .from("menus")
      .insert([
        {
          name,
          price, 
          half_price: half_price || null,
          category_id,
          description: description || null,
          image_url,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      status: true,
      message: "Menu berhasil ditambahkan!",
      data,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateMenu = async (req, res) => {
  const { id } = req.params;
  const { name, price, half_price, category_id, description } = req.body;
  const file = req.file;

  try {
    let updateData = {
      name,
      price,
      half_price: half_price || null,
      category_id,
      description: description || null,
    };

    if (file) {
      const fileExt = file.originalname.split(".").pop();
      const fileName = `${Date.now()}_${name.replace(/\s/g, "")}.${fileExt}`;
      const filePath = `menus/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("ta01-bucket")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("ta01-bucket")
        .getPublicUrl(filePath);

      updateData.image_url = publicUrlData.publicUrl;
    }

    const { data, error } = await supabase
      .from("menus")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      status: true,
      message: "Menu berhasil diperbarui!",
      data,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.deleteMenu = async (req, res) => {
  const { id } = req.params;

  try { 
    const { data: menu, error: findError } = await supabase
      .from("menus")
      .select("image_url")
      .eq("id", id)
      .single();

    if (findError) {
      return res.status(404).json({ status: false, message: "Menu tidak ditemukan" });
    }

    if (menu.image_url) {      
      const bucketName = "ta01-bucket";

      const urlParts = menu.image_url.split(`${bucketName}/`);
      
      if (urlParts.length > 1) {
        const filePath = urlParts[1];

        const { error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([filePath]);

        if (storageError) {
          console.error("Gagal menghapus file di storage:", storageError.message);
        }
      }
    }

    const { error } = await supabase
      .from("menus")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return res.status(200).json({
      status: true,
      message: "Menu berhasil dihapus permanen",
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.getMenus = async (req, res) => {
  const { category_id } = req.query;

  try {
    let query = supabase
      .from("menus")
      .select("*, categories ( name )")
      .order("created_at", { ascending: false });

    if (category_id) {
      query = query.eq("category_id", category_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
