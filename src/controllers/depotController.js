const supabase = require("../config/supabase");
const { encrypt } = require("../utils/crypto");

exports.createDepot = async (req, res) => {
  const { 
    name, address, phone_number, latitude, longitude, map_url,
    shift1_start, shift1_end, shift2_start, shift2_end 
  } = req.body;

  if (!name || !address || !phone_number) {
    return res.status(400).json({
      status: false,
      message: "Nama, Alamat, dan No HP wajib diisi!",
    });
  }

  try {
    const { data: newDepot, error } = await supabase
      .from("depots")
      .insert([{ 
        name, address, phone_number, 
        is_open: true,
        latitude: latitude || null,
        longitude: longitude || null,
        map_url: map_url || null,
        shift1_start: shift1_start || '07:00',
        shift1_end: shift1_end || '14:00',
        shift2_start: shift2_start || null,
        shift2_end: shift2_end || null,
      }])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      status: true,
      message: "Depot berhasil dibuat! Silakan lanjut setting pembayaran.",
      data: newDepot,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateDepot = async (req, res) => {
  const { id } = req.params;
  const { name, address, phone_number, is_open, latitude, longitude, map_url, shift1_start, shift1_end, shift2_start, shift2_end } = req.body;

  try {
    if (req.user.role === 'owner' && String(req.user.depot_id) !== String(id)) {
      return res.status(403).json({ 
        status: false, 
        message: "Akses ditolak! Anda tidak memiliki wewenang mengubah data cabang lain." 
      });
    }

    const { data, error } = await supabase
      .from('depots')
      .update({
        name, address, phone_number, is_open,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        map_url: map_url || null,
        shift1_start: shift1_start || null,
        shift1_end: shift1_end || null,
        shift2_start: shift2_start || null,
        shift2_end: shift2_end || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res
      .status(200)
      .json({ status: true, message: "Data depot diperbarui", data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.getDepots = async (req, res) => {
  try {
    const { data: depots, error } = await supabase
      .from("depots")
      .select("*, payment_configs(*)")
      .order("id", { ascending: true });

    if (error) throw error;

    const { data: owners, error: ownerError } = await supabase
      .from("profiles")
      .select("depot_id, full_name")
      .eq("role", "owner");
      
    if (ownerError) throw ownerError;

    const formattedDepots = depots.map((depot) => {
      const matchOwner = owners?.find((o) => o.depot_id === depot.id);
      return {
        ...depot,
        owner_name: matchOwner ? matchOwner.full_name : null,
      };
    });

    return res.status(200).json({
      status: true,
      message: "Berhasil mengambil daftar depot",
      data: formattedDepots,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.getDepotDetail = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: depot, error } = await supabase
      .from("depots")
      .select("*, payment_configs(*)")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({ status: false, message: "Depot tidak ditemukan" });
    }
    
    return res.status(200).json({ status: true, data: depot });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.setupPayment = async (req, res) => {
  const { id } = req.params;
  const { merchant_id, midtrans_client_key, midtrans_server_key } = req.body;

  if (!merchant_id || !midtrans_client_key || !midtrans_server_key) {
    return res.status(400).json({ message: "Semua data kredensial Midtrans wajib diisi!" });
  }

  try {
    const { data: depot } = await supabase
      .from("depots")
      .select("id")
      .eq("id", id)
      .single();
      
    if (!depot) return res.status(404).json({ message: "Depot tidak ditemukan" });

    const encryptedMerchantId = encrypt(merchant_id);
    const encryptedClientKey = encrypt(midtrans_client_key);
    const encryptedServerKey = encrypt(midtrans_server_key);

    const { data, error } = await supabase
      .from("payment_configs")
      .upsert(
        {
          depot_id: id,
          merchant_id: encryptedMerchantId,
          midtrans_client_key: encryptedClientKey,
          midtrans_server_key: encryptedServerKey,
        },
        { onConflict: "depot_id" },
      )
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      status: true,
      message: "Konfigurasi Pembayaran Midtrans Berhasil Disimpan Secara Aman!",
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.toggleStatus = async (req, res) => {
  const { id } = req.params;
  const { is_open } = req.body;

  // jika kasir, pastikan kasir pada depot tersebut
  if (req.user.role === "kasir" || req.user.role === "owner") {
    if (req.user.depot_id != id) {
      return res
        .status(403)
        .json({ message: "Anda bukan kasir di depot ini!" });
    }
  }

  try {
    const { data, error } = await supabase
      .from("depots")
      .update({ is_open })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      status: true,
      message: `Depot sekarang ${is_open ? "BUKA" : "TUTUP"}`,
      data,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};


exports.deleteDepot = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("depots")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return res.status(200).json({ 
      status: true, 
      message: "Data depot berhasil dihapus!" 
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.assignMenus = async (req, res) => {
  const { id } = req.params; 
  const { menu_ids } = req.body; 

  try {
    await supabase.from("depot_menus").delete().eq("depot_id", id);

    if (menu_ids && menu_ids.length > 0) {
      const inserts = menu_ids.map(menuId => ({
        depot_id: id,
        menu_id: menuId,
        is_available: true
      }));
      const { error } = await supabase.from("depot_menus").insert(inserts);
      if (error) throw error;
    }

    return res.status(200).json({ status: true, message: "Menu depot berhasil diperbarui!" });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.getDepotMenus = async (req, res) => {
  const { id } = req.params;
  
  try {
    const { data, error } = await supabase
      .from("depot_menus")
      .select(`
        id,
        is_available,
        menus ( id, name, price, half_price, image_url, description, categories ( id, name ) )
      `)
      .eq("depot_id", id);

    if (error) throw error;

    const formattedData = data.map(item => ({
      ...item.menus,
      depot_menu_id: item.id,
      is_available: item.is_available
    }));

    return res.status(200).json({ status: true, data: formattedData });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateMenuStatus = async (req, res) => {
  const { id, menuId } = req.params;
  const { is_available } = req.body;

  try {
    if (typeof is_available !== 'boolean') {
      return res.status(400).json({ status: false, message: "is_available harus berupa boolean" });
    }

    // Update langsung ke tabel pivot (depot_menus)
    const { error } = await supabase
      .from("depot_menus")
      .update({ is_available: is_available })
      .eq("depot_id", id)
      .eq("menu_id", menuId);

    if (error) throw error;

    return res.status(200).json({ 
      status: true, 
      message: "Status ketersediaan menu berhasil diperbarui!" 
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};