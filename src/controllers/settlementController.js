const supabase = require("../config/supabase");

exports.getTodaySummary = async (req, res) => {
  const { depot_id } = req.params;

  try {
    const { data: transactions, error: errTx } = await supabase
      .from("transactions")
      .select(
        `
        id, customer_name, subtotal, tax_amount, grand_total, type, payment_method, created_at, pickup_method,
        table_id, tables(table_number),
        transaction_payments(paid_amount, change_amount, payment_methods(name))
      `,
      )
      .eq("depot_id", depot_id)
      .eq("is_settled", false)
      .eq("order_status", "completed")
      .eq("payment_status", "paid");

    if (errTx) throw errTx;

    const { data: expenses, error: errExp } = await supabase
      .from("operational_expenses")
      .select("id, item_name, amount, quantity, unit, expense_date, note")
      .eq("depot_id", depot_id)
      .eq("is_settled", false);

    if (errExp) throw errExp;

    let subtotal_all = 0;
    let tax_all = 0;
    let grand_total_all = 0;
    let methods_map = {};

    const mappedTransactions =  transactions.map((tx) => {
      subtotal_all += Number(tx.subtotal || 0);
      tax_all += Number(tx.tax_amount || 0);
      grand_total_all += Number(tx.grand_total || 0);

      if (tx.transaction_payments) {
        tx.transaction_payments.forEach((p) => {
          const methodName = p.payment_methods?.name || "Lainnya";
          const paid = Number(p.paid_amount || 0);
          const change = Number(p.change_amount || 0);
          const net = paid - change;

          if (!methods_map[methodName]) {
            methods_map[methodName] = { 
              method_name: methodName, 
              transaction_count: 0, 
              total_net_amount: 0 
            };
          }

          methods_map[methodName].transaction_count += 1;
          methods_map[methodName].total_net_amount += net;
        });
      }

      return { ...tx, table_number: tx.tables?.table_number || null };
    });

    let total_expenses = 0;
    expenses.forEach((exp) => {
      total_expenses += Number(exp.amount || 0);
    });

    const net_income = subtotal_all - total_expenses;

    return res.status(200).json({
      status: true,
      data: {
        summary: {
          total_transactions: transactions.length,
          subtotal_amount: subtotal_all,
          tax_amount: tax_all,
          grand_total: grand_total_all,
          total_expenses,
          net_income,
          payment_methods: Object.values(methods_map)
        },
        transactions: mappedTransactions,
        expenses,
      },
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.processSettlement = async (req, res) => {
  const { depot_id, settlement_date, summary_data } = req.body;
  const created_by = req.user.id;

  try {
    const { data: expenses } = await supabase
      .from("operational_expenses")
      .select("id, amount")
      .eq("depot_id", depot_id)
      .eq("is_settled", false)
      .lte("expense_date", settlement_date);

    console.log("summary data:", summary_data);
    let total_expenses = 0;
    let expenseIds = [];

    if (expenses && expenses.length > 0) {
      total_expenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
      expenseIds = expenses.map(e => e.id);
    }

    const net_income = summary_data.subtotal_amount - total_expenses;

    const { data: newSettlement, error: insertError } = await supabase
      .from("daily_settlements")
      .insert([{
        depot_id,
        created_by,
        settlement_date,
        total_transactions: summary_data.total_transactions,
        subtotal_amount: summary_data.subtotal_amount,
        tax_amount: summary_data.tax_amount,
        grand_total: summary_data.grand_total,
        total_expenses,
        net_income
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    await supabase
      .from("transactions")
      .update({ is_settled: true, settlement_id: newSettlement.id })
      .eq("depot_id", depot_id)
      .eq("is_settled", false)
      .eq("payment_status", "paid");

    if (expenseIds.length > 0) {
      await supabase
        .from("operational_expenses")
        .update({ is_settled: true, settlement_id: newSettlement.id })
        .in("id", expenseIds);
    }

    return res.status(201).json({ status: true, message: "Tutup kasir berhasil", data: newSettlement });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getSettlements = async (req, res) => {
  const { depot_id } = req.params;
  const { startDate, endDate } = req.query;

  try {
    let query = supabase
      .from("daily_settlements")
      .select("*, creator:profiles(full_name)")
      .eq("depot_id", depot_id);

    if (startDate && endDate) {
      query = query.gte("settlement_date", startDate).lte("settlement_date", endDate);
    }

    const { data: settlements, error } = await query.order("settlement_date", { ascending: true });
    
    if (error) throw error;

    if (!settlements || settlements.length === 0) {
      return res.status(200).json({ 
        status: true, 
        data: { 
          settlements: [], 
          paymentSummary: [],
          transactionTypeSummary: [],
          topMenuSummary: []
        } 
      });
    }

    const settlementIds = settlements.map(settlement => settlement.id);

    const { data: transactionsData, error: errTx } = await supabase
      .from("transactions")
      .select(`
        id,
        type,
        transaction_payments (
          payment_methods ( name )
        ),
        transaction_items (
          quantity,
          menus ( name )
        )
      `)
      .in("settlement_id", settlementIds)
      .eq("payment_status", "paid");

    if (errTx) throw errTx;

    const methodsMap = {};
    const typesMap = { dining: 0, takeaway: 0, online: 0 };
    const menuMap = {};

    transactionsData.forEach(tx => {
      if (tx.type) {
        typesMap[tx.type] = (typesMap[tx.type] || 0) + 1;
      }

      if (tx.transaction_payments && tx.transaction_payments.length > 0) {
        tx.transaction_payments.forEach(payment => {
          const methodName = payment.payment_methods?.name || "Tunai";
          if (!methodsMap[methodName]) methodsMap[methodName] = { name: methodName, value: 0 };
          methodsMap[methodName].value += 1;
        });
      } else {
        if (!methodsMap["Tunai"]) methodsMap["Tunai"] = { name: "Tunai", value: 0 };
        methodsMap["Tunai"].value += 1;
      }

      if (tx.transaction_items && tx.transaction_items.length > 0) {
        tx.transaction_items.forEach(item => {
          const menuName = item.menus?.name || "Menu Dihapus";
          if (!menuMap[menuName]) menuMap[menuName] = { name: menuName, value: 0 };
          menuMap[menuName].value += item.quantity;
        });
      }
    });

    const transactionTypeSummary = [
      { name: "Dining", value: typesMap.dining },
      { name: "Takeaway", value: typesMap.takeaway },
      { name: "Online", value: typesMap.online }
    ].filter(t => t.value > 0);

    const topMenuSummary = Object.values(menuMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return res.status(200).json({
      status: true,
      data: {
        settlements: settlements,
        paymentSummary: Object.values(methodsMap),
        transactionTypeSummary,
        topMenuSummary
      }
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getSettlementDetail = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: settlement, error: errSet } = await supabase
      .from("daily_settlements")
      .select(`*, 
        depot:depots(id, name, address, phone_number),
        creator:profiles!created_by(full_name)
      `)
      .eq("id", id)
      .single();

    if (errSet) throw errSet;

    const { data: transactions, error: errTx } = await supabase
      .from("transactions")
      .select(`
        id, customer_name, subtotal, tax_amount, grand_total, type, payment_method, created_at, pickup_method,
        table_id, tables(table_number),
        transaction_payments(paid_amount, change_amount, payment_methods(name))
      `)
      .eq("settlement_id", id);

    if (errTx) throw errTx;

    const { data: expenses, error: errExp } = await supabase
      .from("operational_expenses")
      .select("id, item_name, amount, quantity, unit, expense_date, note")
      .eq("settlement_id", id);

    if (errExp) throw errExp;

    let methods_map = {};
    const mappedTransactions = transactions.map((tx) => {
      let total_paid = 0;
      let change_amount = 0;

      if (tx.transaction_payments) {
        tx.transaction_payments.forEach((p) => {
          const methodName = p.payment_methods?.name || "Lainnya";
          const paid = Number(p.paid_amount || 0);
          const change = Number(p.change_amount || 0);
          const net = paid - change;

          if (!methods_map[methodName]) {
            methods_map[methodName] = { method_name: methodName, transaction_count: 0, total_net_amount: 0 };
          }

          methods_map[methodName].transaction_count += 1;
          methods_map[methodName].total_net_amount += net;
        });
      }
      return { ...tx, table_number: tx.tables?.table_number || null };
    });

    return res.status(200).json({
      status: true,
      data: {
        settlement,
        summary: {
          total_transactions: settlement.total_transactions,
          subtotal_amount: settlement.subtotal_amount,
          tax_amount: settlement.tax_amount,
          grand_total: settlement.grand_total,
          total_expenses: settlement.total_expenses,
          net_income: settlement.net_income,
          payment_methods: Object.values(methods_map)
        },
        transactions: mappedTransactions,
        expenses
      }
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getSettlementTransactions = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select(`*`)
      .eq("settlement_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.status(200).json({ status: true, data });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
