const supabase = require("../config/supabase");

exports.getExpenses = async (req, res) => {
  const { depot_id } = req.params;
  const { startDate, endDate } = req.query;

  try {
    let query = supabase
      .from("operational_expenses")
      .select("*, profiles(full_name)")
      .eq("depot_id", depot_id)
      .order("expense_date", { ascending: false });

    if (startDate && endDate) {
      query = query
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.createExpense = async (req, res) => {
  const { depot_id, item_name, amount, quantity, unit, expense_date, note } = req.body;
  const created_by = req.user.id;

  if (!depot_id || !item_name || !amount || !expense_date) {
    return res.status(400).json({ status: false, message: "Data pengeluaran wajib diisi" });
  }

  try {
    const { data: existingSettlement, error: checkError } = await supabase
      .from("daily_settlements")
      .select("id, total_expenses, net_income")
      .eq("depot_id", depot_id)
      .eq("settlement_date", expense_date)
      .single();

    let newExpense = {
      depot_id, item_name, amount, quantity, unit, expense_date, note, created_by,
      is_settled: false,
      settlement_id: null
    };

    if (existingSettlement) {
      newExpense.is_settled = true;
      newExpense.settlement_id = existingSettlement.id;
    }

    const { data, error } = await supabase.from("operational_expenses").insert([newExpense]).select();
    if (error) throw error;

    if (existingSettlement) {
      const newTotalExpenses = existingSettlement.total_expenses + amount;
      const newNetIncome = existingSettlement.net_income - amount;

      await supabase
        .from("daily_settlements")
        .update({ total_expenses: newTotalExpenses, net_income: newNetIncome })
        .eq("id", existingSettlement.id);
    }

    return res.status(201).json({ status: true, message: "Pengeluaran berhasil dicatat", data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: check } = await supabase.from("operational_expenses").select("is_settled").eq("id", id).single();
    if (check && check.is_settled) {
      return res.status(400).json({ status: false, message: "Tidak bisa dihapus karena sudah masuk buku Settlement!" });
    }

    const { error } = await supabase.from("operational_expenses").delete().eq("id", id);
    if (error) throw error;
    return res.status(200).json({ status: true, message: "Data pengeluaran dihapus" });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateExpense = async (req, res) => {
  const { id } = req.params;
  const { item_name, amount, expense_date, note } = req.body;

  try {
    const { data: check } = await supabase.from("operational_expenses").select("is_settled").eq("id", id).single();
    if (check && check.is_settled) {
      return res.status(400).json({ status: false, message: "Tidak bisa diedit karena sudah masuk buku Settlement!" });
    }

    const { data, error } = await supabase.from("operational_expenses").update({ item_name, amount, expense_date, note }).eq("id", id).select();
    if (error) throw error;
    return res.status(200).json({ status: true, message: "Data pengeluaran diperbarui", data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};