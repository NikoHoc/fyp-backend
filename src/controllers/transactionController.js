const supabase = require("../config/supabase");
const { snap } = require("../config/midtrans");

exports.createTransaction = async (req, res) => {
  const { depot_id, user_id, type, table_id, customer_id, customer_name, pickup_method, use_tax, items } = req.body;

  if (!depot_id || !items || items.length === 0) {
    return res
      .status(400)
      .json({ status: false, message: "Data pesanan tidak lengkap" });
  }

  try {
    let subtotal = 0;
    const itemInserts = [];

    for (const item of items) {
      const { data: menu } = await supabase
        .from("menus")
        .select("price, half_price")
        .eq("id", item.menu_id)
        .single();
      if (!menu) throw new Error(`Menu ID ${item.menu_id} tidak ditemukan`);

      const priceToUse = item.is_half_portion ? menu.half_price : menu.price;
      const itemTotal = priceToUse * item.quantity;
      subtotal += itemTotal;

      itemInserts.push({
        menu_id: item.menu_id,
        quantity: item.quantity,
        price_at_time: priceToUse,
        is_half_portion: item.is_half_portion || false,
        note: item.note,
        batch_number: item.batch_number || 1
      });
    }

    let useTax = false;
    
    if (type === "online") {
      useTax = false; 
    } else {
      useTax = use_tax === true;
    }

    const tax_amount = useTax ? subtotal * 0.1 : 0;
    const grand_total = subtotal + tax_amount;

    let initialStatus = type === "online" ? "waiting_confirmation" : "pending";

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert([
        {
          depot_id,
          user_id,
          type,
          table_id: table_id || null,
          customer_id: customer_id || null,
          customer_name: customer_name || null,
          pickup_method: pickup_method || null,
          subtotal,
          tax_amount,
          grand_total,
          order_status: initialStatus,
          payment_status: "unpaid",
          is_settled: false
        },
      ])
      .select()
      .single();

    if (transactionError) throw transactionError;

    const itemsWithTransId = itemInserts.map((i) => ({
      ...i,
      transaction_id: transaction.id,
    }));

    const { error: itemsError } = await supabase
      .from("transaction_items")
      .insert(itemsWithTransId);

    if (itemsError) throw itemsError;

    return res.status(201).json({
      status: true,
      message:
        type === "online" ? "Menunggu konfirmasi" : "Pesanan masuk dapur",
      data: { transaction, new_items: itemInserts },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.addTransactionItems = async (req, res) => {
  const { id } = req.params;
  const { items = [], customer_name } = req.body;

  try {
    const { data: transaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (!transaction || transaction.payment_status === "paid") {
      return res
        .status(400)
        .json({ message: "Transaksi tidak valid atau sudah dibayar" });
    }

    let additionalSubtotal = 0;
    const itemInserts = [];

    if (items.length > 0) {
      for (const item of items) {
        const { data: menu } = await supabase
          .from("menus")
          .select("price, half_price")
          .eq("id", item.menu_id)
          .single();
  
        const priceToUse = item.is_half_portion ? menu.half_price : menu.price;
        additionalSubtotal += priceToUse * item.quantity;
  
        itemInserts.push({
          transaction_id: id,
          menu_id: item.menu_id,
          quantity: item.quantity,
          price_at_time: priceToUse,
          is_half_portion: item.is_half_portion || false,
          note: item.note,
          is_printed: false,
          batch_number: item.batch_number
        });
      }
  
      const { error: itemsError } = await supabase
        .from("transaction_items")
        .insert(itemInserts);
  
      if (itemsError) throw itemsError;
    }

    const updatePayload = {};

    if (customer_name !== undefined) {
      updatePayload.customer_name = customer_name;
    }

    if (additionalSubtotal > 0) {
      const currentSubtotal = Number(transaction.subtotal) || 0;
      const newSubtotal = currentSubtotal + additionalSubtotal;
      
      const isUsingTax = Number(transaction.tax_amount) > 0;
      const newTax = isUsingTax ? (newSubtotal * 0.1) : 0;
      const newGrandTotal = newSubtotal + newTax;

      updatePayload.subtotal = newSubtotal;
      updatePayload.tax_amount = newTax;
      updatePayload.grand_total = newGrandTotal;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from("transactions")
        .update(updatePayload)
        .eq("id", id);
        
      if (updateError) throw updateError;
    }

    return res.status(201).json({
      status: true,
      message: "Pesanan tambahan berhasil dimasukkan",
      data: { 
        added_items: itemInserts, 
        new_grand_total: updatePayload.grand_total || transaction.grand_total, 
        updatePayload 
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateCustomerInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name } = req.body;

    const { data, error } = await supabase
      .from("transactions")
      .update({ customer_name: customer_name || null })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ status: true, message: "Nama pelanggan berhasil diperbarui", data });
  } catch (error) {
    console.error("Error update customer info:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.confirmTransaction = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: transaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (!transaction) return res.status(404).json({ message: "Transaksi tidak ditemukan" });

    if (transaction.type !== "online" || transaction.order_status !== "waiting_confirmation") {
      return res.status(400).json({ message: "Aksi tidak valid. Hanya untuk pesanan online yang menunggu konfirmasi." });
    }

    let customerName = "Pelanggan";
    let customerEmail = "customer@example.com";
    let customerPhone = "081111111111";

    if (transaction.customer_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, phone_number")
        .eq("id", transaction.customer_id)
        .single();
      
      if (profile) {
        if (profile.full_name) customerName = profile.full_name;
        if (profile.email) customerEmail = profile.email;
        if (profile.phone_number) customerPhone = profile.phone_number;
      }
    }

    const { data: transactionItems } = await supabase
      .from("transaction_items")
      .select("quantity, price_at_time, menus(name)")
      .eq("transaction_id", id);

    let itemDetails = transactionItems.map((item) => ({
      id: item.menus.name.substring(0, 20), 
      price: item.price_at_time,
      quantity: item.quantity,
      name: item.menus.name.substring(0, 50), 
    }));

    const midtransOrderId = `ORDER-${transaction.id}-${Date.now()}`;

    const parameter = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: transaction.grand_total,
      },
      item_details: itemDetails, 
      customer_details: {
        first_name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
      custom_expiry: {
        expiry_duration: 15, 
        unit: "minute"
      }
    };

    const midtransResponse = await snap.createTransaction(parameter);

    const { data: updatedTransaction, error } = await supabase
      .from("transactions")
      .update({
        order_status: "waiting_payment",
        snap_token: midtransResponse.token,
        midtrans_url: midtransResponse.redirect_url,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ status: true, message: "Pesanan diterima. Link pembayaran dibuat.", data: updatedTransaction });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.rejectTransaction = async (req, res) => {
  const { id } = req.params;
  const { rejection_reason } = req.body; 

  if (!rejection_reason) {
    return res.status(400).json({ message: "Alasan penolakan wajib diisi!" });
  }

  try {
    const { data, error } = await supabase
      .from("transactions")
      .update({ 
        order_status: "cancelled", 
        rejection_reason: rejection_reason 
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ 
      status: true, 
      message: "Pesanan berhasil ditolak", 
      data 
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.midtransNotification = async (req, res) => {
  const notificationJson = req.body;

  try {
    const statusResponse =
      await snap.transaction.notification(notificationJson);
    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    const realTransactionId = orderId.split("-")[1];

    let newStatus = null;
    let newPaymentStatus = null;

    if (transactionStatus == "capture") {
      if (fraudStatus == "accept") {
        newStatus = "process";
        newPaymentStatus = "paid";
      }
    } else if (transactionStatus == "settlement") {
      newStatus = "process";
      newPaymentStatus = "paid";
    } else if (
      transactionStatus == "cancel" ||
      transactionStatus == "deny" ||
      transactionStatus == "expire"
    ) {
      newStatus = "cancelled";
      newPaymentStatus = "failed";
    }

    if (newStatus) {
      await supabase
        .from("transactions")
        .update({ order_status: newStatus, payment_status: newPaymentStatus })
        .eq("id", realTransactionId);
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Midtrans Error:", err.message);
    return res.status(500).send("Error processing notification");
  }
};

exports.getTransactions = async (req, res) => {
  const { depot_id } = req.params;
  const { status } = req.query;

  try {
    let query = supabase
      .from("transactions")
      .select(`
        *,
        tables (table_number),
        transaction_items (*),
        transaction_payments (*)
      `)
      .eq("depot_id", depot_id);

    if (status === 'active') {
      query = query
        .neq('order_status', 'completed')
        .neq('order_status', 'cancelled');
    } 
    else if (status === 'completed') {
      query = query.eq('order_status', 'completed');
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.getTransactionDetail = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        *,
        tables(table_number),
        transaction_items (
          *,
          menus (name, image_url, categories (id, name, type))
        ),
        transaction_payments (
          *,
          payment_methods (name),
          transaction_payment_items (*)
        )
      `)
      .eq("id", id)
      .single();
    if (error) throw error;
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateTransactionStatus = async (req, res) => {
  const { id } = req.params;
  const { order_status, payment_status } = req.body;

  try {
    const updateData = {};
    if (order_status) updateData.order_status = order_status;
    if (payment_status) updateData.payment_status = payment_status;

    const { data, error } = await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res
      .status(200)
      .json({ status: true, message: "Status diperbarui", data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateItemsPrintStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("transaction_items")
      .update({ is_printed: true })
      .eq("transaction_id", id)
      .eq("is_printed", false)
      .select(); 

    if (error) throw error;

    return res.status(200).json({ 
      status: true, 
      message: "Status print item berhasil diperbarui",
      updated_items: data 
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.processPayment = async (req, res) => {
  const { id } = req.params; 
  const { 
    payment_method_id, 
    paid_amount, 
    change_amount, 
    items
  } = req.body;

  try {
    // buat section pembayaran
    const { data: payment, error: pError } = await supabase
      .from("transaction_payments")
      .insert([{
        transaction_id: id,
        payment_method_id,
        paid_amount,
        change_amount
      }])
      .select()
      .single();

    if (pError) throw pError;

    for (const item of items) {
      // input item yang sudah dibayar
      await supabase.from("transaction_payment_items").insert([{
        transaction_payment_id: payment.id,
        transaction_item_id: item.transaction_item_id,
        quantity: item.quantity,
        price_at_time: item.price_at_time
      }]);

      // update quantity paid pada transaction items
      const { data: currentItem } = await supabase
        .from("transaction_items")
        .select("quantity_paid")
        .eq("id", item.transaction_item_id)
        .single();

      await supabase
        .from("transaction_items")
        .update({ quantity_paid: (currentItem.quantity_paid || 0) + item.quantity })
        .eq("id", item.transaction_item_id);
    }

    // mendapatkan metode pembayaran transaksi
    const { data: allPayments } = await supabase
      .from("transaction_payments")
      .select("payment_methods(name)")
      .eq("transaction_id", id);

    const methods = [...new Set(allPayments.map(p => p.payment_methods.name))].join(", ");
    
    // mengecek apakah transaction items sudah lunas semua?
    const { data: allItems } = await supabase
      .from("transaction_items")
      .select("quantity, quantity_paid")
      .eq("transaction_id", id);

    const isFullyPaid = allItems.every(i => i.quantity_paid >= i.quantity);

    // update transaksi
    const { data: finalTx } = await supabase
      .from("transactions")
      .update({
        payment_method: methods,
        payment_status: isFullyPaid ? 'paid' : 'unpaid',
      })
      .eq("id", id)
      .select()
      .single();

    return res.status(200).json({ status: true, message: "Pembayaran Berhasil", data: finalTx });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// order cart feature
exports.updateServeStatus = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { serve_status } = req.body;

    if (!['cooking', 'served'].includes(serve_status)) {
      return res.status(400).json({ status: false, message: "Status tidak valid" });
    }

    const { data, error } = await supabase
      .from("transaction_items")
      .update({ serve_status })
      .match({ id: itemId, transaction_id: id })
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ status: false, message: "Item tidak ditemukan" });

    return res.status(200).json({ status: true, message: "Status pesanan diperbarui", data });
  } catch (error) {
    console.error("Error update serve status:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.updateItemQuantity = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 1) {
      return res.status(400).json({ status: false, message: "Kuantitas minimal adalah 1" });
    }

    const { data, error } = await supabase
      .from("transaction_items")
      .update({ quantity })
      .match({ id: itemId, transaction_id: id })
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ status: false, message: "Item tidak ditemukan" });

    return res.status(200).json({ status: true, message: "Kuantitas diperbarui", data });
  } catch (error) {
    console.error("Error update item quantity:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.deleteTransactionItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const { data, error } = await supabase
      .from("transaction_items")
      .delete()
      .match({ id: itemId, transaction_id: id })
      .select()
      .single();

    if (error) throw error;
    
    return res.status(200).json({ status: true, message: "Item pesanan berhasil dibatalkan", data });
  } catch (error) {
    console.error("Error delete item:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};