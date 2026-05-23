const supabase = require("../config/supabase");

const selectQuery = `
  id, created_by, item_name, requested_quantity, sent_quantity, 
  unit, status, requester_notes, rejection_reason, created_at,
  requester_id, provider_id,
  requester:depots!requester_id(name),
  provider:depots!provider_id(name),
  creator:profiles!created_by(full_name)
`;

exports.getMutations = async (req, res) => {
  const { depot_id } = req.params;
  const { startDate, endDate, status  } = req.query;

  try {
    // const { data, error } = await supabase
    //   .from("stock_mutations")
    //   .select(selectQuery)
    //   .or(`requester_id.eq.${depot_id},provider_id.eq.${depot_id}`)
    //   .order("created_at", { ascending: false });

    let query = supabase
      .from("stock_mutations")
      .select(selectQuery)
      .order("created_at", { ascending: false });

    if (depot_id && depot_id !== "null" && depot_id !== "undefined") {
      query = query.or(`requester_id.eq.${depot_id},provider_id.eq.${depot_id}`);
    }

    if (startDate && endDate) {
      query = query
        .gte("created_at", startDate)
        .lte("created_at", endDate);
    }

    if (status) {
      if (status === 'active') {
        query = query.eq('status', 'pending');
      } else if (status === 'history') {
        query = query.neq('status', 'pending');
      }
    }

    const { data, error } = await query;

    if (error) throw error;
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.createMutation = async (req, res) => {
  const { requester_id, provider_id, item_name, requested_quantity, unit, requester_notes } = req.body;
  const created_by = req.user.id;

  if (!requester_id || !provider_id || !item_name || !requested_quantity || !unit) {
    return res.status(400).json({ status: false, message: "Data mutasi tidak lengkap" });
  }

  try {
    const { data, error } = await supabase
      .from("stock_mutations")
      .insert([
        {
          created_by,
          requester_id,
          provider_id,
          item_name,
          requested_quantity,
          unit,
          requester_notes,
          status: "pending",
        },
      ])
      .select(selectQuery)
      .single();

    if (error) throw error;

    return res.status(201).json({
      status: true,
      message: "Permintaan mutasi stok berhasil dibuat",
      data,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateMutation = async (req, res) => {
  const { id } = req.params;
  const { item_name, requested_quantity, unit, provider_id, requester_notes } = req.body;

  try {
    const { data: existing } = await supabase
      .from("stock_mutations")
      .select("status")
      .eq("id", id)
      .single();

    if (!existing) return res.status(404).json({ message: "Data tidak ditemukan" });

    if (existing.status !== "pending") {
      return res.status(400).json({
        status: false,
        message: "Gagal! Data hanya bisa diedit jika status masih Pending.",
      });
    }

    const { data, error } = await supabase
      .from("stock_mutations")
      .update({
        item_name,
        requested_quantity,
        unit,
        provider_id,
        requester_notes,
      })
      .eq("id", id)
      .select(selectQuery)
      .single();

    if (error) throw error;

    return res.status(200).json({
      status: true,
      message: "Data permintaan mutasi berhasil diperbarui",
      data,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.deleteMutation = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: existing } = await supabase
      .from("stock_mutations")
      .select("status")
      .eq("id", id)
      .single();

    if (!existing) return res.status(404).json({ message: "Data tidak ditemukan" });

    if (existing.status !== "pending") {
      return res.status(400).json({
        status: false,
        message: "Gagal! Hanya mutasi status Pending yang boleh dibatalkan.",
      });
    }

    const { error } = await supabase.from("stock_mutations").delete().eq("id", id);

    if (error) throw error;

    return res.status(200).json({
      status: true,
      message: "Permintaan mutasi berhasil dibatalkan",
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.processMutation = async (req, res) => {
  const { id } = req.params;
  const { status, sent_quantity, rejection_reason } = req.body;

  try {
    const updateData = { status };
    
    if (status === 'completed') {
      updateData.sent_quantity = sent_quantity;
    } else if (status === 'rejected') {
      updateData.rejection_reason = rejection_reason;
    }

    const { data, error } = await supabase
      .from("stock_mutations")
      .update(updateData)
      .eq("id", id)
      .select(selectQuery)
      .single();

    if (error) throw error;
    res.status(200).json({ 
        status: true, 
        message: `Permintaan mutasi berhasil di-${status === 'completed' ? 'terima' : 'tolak'}`,
        data 
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};