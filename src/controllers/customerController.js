const supabase = require('../config/supabase');

exports.getProfile = async (req, res) => {
  try {
    const customerId = req.user.id;

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, username, phone_number, role, created_at')
      .eq('id', customerId)
      .single();

    if (profileErr) throw profileErr;

    const { count, error: countErr } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('order_status', 'completed');

    if (countErr) throw countErr;

    res.status(200).json({
      success: true,
      data: {
        ...profile,
        total_transactions: count || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCart = async (req, res) => {
  try {
    const customerId = req.user.id;

    const { data: cart, error: cartErr } = await supabase
      .from('carts')
      .select(`
        id, customer_id, depot_id,
        cart_items (
          id, quantity, is_half_portion, note,
          menu:menus ( id, name, price, image_url )
        )
      `)
      .eq('customer_id', customerId)
      .single();

    if (cartErr && cartErr.code !== 'PGRST116') throw cartErr;
    
    if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
      return res.status(200).json({ success: true, data: null });
    }

    let subtotal = 0;
    let totalItems = 0;

    const formattedItems = cart.cart_items.map(item => {
      const basePrice = item.menu.price;
      const finalPrice = item.is_half_portion ? basePrice / 2 : basePrice;
      const itemTotal = finalPrice * item.quantity;
      
      subtotal += itemTotal;
      totalItems += item.quantity;

      return {
        id: item.id,
        menu_id: item.menu.id,
        name: item.menu.name,
        image_url: item.menu.image_url,
        price: finalPrice,
        original_price: basePrice,
        quantity: item.quantity,
        is_half_portion: item.is_half_portion,
        note: item.note,
        item_total: itemTotal
      };
    });

    const taxAmount = Math.round(subtotal * 0.10);
    const grandTotal = subtotal + taxAmount;

    res.status(200).json({
      success: true,
      data: {
        id: cart.id,
        depot_id: cart.depot_id,
        subtotal,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        total_items: totalItems,
        items: formattedItems
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addOrUpdateCartItem = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { depot_id, menu_id, quantity, is_half_portion = false, note = '', cart_item_id } = req.body;
    let { data: cart } = await supabase.from('carts').select('*').eq('customer_id', customerId).single();

    if (cart && cart.depot_id !== depot_id) {
      const { count } = await supabase
        .from('cart_items')
        .select('*', { count: 'exact', head: true })
        .eq('cart_id', cart.id);
        
      if (count > 0) {
        return res.status(409).json({ 
          success: false, 
          message: 'Terdapat pesanan di cabang lain.',
          conflict_depot_id: cart.depot_id
        });
      } else {
        await supabase.from('carts').update({ depot_id }).eq('id', cart.id);
        cart.depot_id = depot_id;
      }
    }

    if (!cart) {
      const { data: newCart, error: newCartErr } = await supabase
        .from('carts')
        .insert([{ customer_id: customerId, depot_id }])
        .select()
        .single();
      if (newCartErr) throw newCartErr;
      cart = newCart;
    }

    if (cart_item_id) {
      if (quantity <= 0) {
        await supabase.from('cart_items').delete().eq('id', cart_item_id);
      } else {
        await supabase.from('cart_items').update({ quantity, is_half_portion, note }).eq('id', cart_item_id);
      }
    } else if (quantity > 0) {
      await supabase.from('cart_items').insert([{
        cart_id: cart.id,
        menu_id,
        quantity,
        is_half_portion,
        note
      }]);
    }

    res.status(200).json({ success: true, message: 'Item keranjang berhasil diperbarui' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.from('cart_items').delete().eq('id', id);
    res.status(200).json({ success: true, message: 'Item berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { data: cart } = await supabase.from('carts').select('id').eq('customer_id', customerId).single();
    if (cart) {
      await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    }
    res.status(200).json({ success: true, message: 'Keranjang dibersihkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.checkoutCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { pickup_method } = req.body;

    const { data: profile } = await supabase.from('profiles').select('full_name, phone_number').eq('id', customerId).single();

    const { data: cart } = await supabase
      .from('carts')
      .select(`
        id, depot_id,
        cart_items (
          menu_id, quantity, is_half_portion, note,
          menu:menus ( price, half_price )
        )
      `)
      .eq('customer_id', customerId)
      .single();

    if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
      return res.status(400).json({ success: false, message: 'Keranjang Anda kosong.' });
    }

    let subtotal = 0;
    const transactionItemsData = [];

    cart.cart_items.forEach(item => {
      let price = item.menu.price;
      if (item.is_half_portion && item.menu.half_price) {
        price = item.menu.half_price;
      }
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      transactionItemsData.push({
        menu_id: item.menu_id,
        quantity: item.quantity,
        price_at_time: price,
        is_half_portion: item.is_half_portion,
        note: item.note
      });
    });

    const taxAmount = Math.round(subtotal * 0.10);
    const grandTotal = subtotal + taxAmount;

    const { data: transaction, error: trxErr } = await supabase
      .from('transactions')
      .insert([{
        depot_id: cart.depot_id,
        customer_id: customerId,
        customer_name: profile.full_name || 'Pelanggan Online',
        customer_phone: profile.phone_number || '-',
        type: 'online',
        order_status: 'pending',
        payment_status: 'unpaid',
        subtotal,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        pickup_method: pickup_method || 'self_pickup'
      }])
      .select()
      .single();

    if (trxErr) throw trxErr;

    const finalItemsToInsert = transactionItemsData.map(item => ({
      ...item,
      transaction_id: transaction.id
    }));

    const { error: itemsErr } = await supabase.from('transaction_items').insert(finalItemsToInsert);
    if (itemsErr) throw itemsErr;

    await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    
    res.status(201).json({ 
      success: true, 
      message: 'Pesanan berhasil dikirim ke Kasir.',
      data: { transaction_id: transaction.id }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllTransactions = async (req, res) => {
  try {
    const customerId = req.user.id;

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        id, 
        created_at, 
        order_status, 
        grand_total,
        depot:depots(name),
        transaction_items ( quantity )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTrackingDetail = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { id } = req.params; 

    const { data: transaction, error } = await supabase
      .from('transactions')
      .select(`
        *,
        depot:depots(name, address, phone_number),
        transaction_items (
          id, quantity, price_at_time, is_half_portion, note,
          menu:menus(name, image_url)
        )
      `)
      .eq('id', id)
      .eq('customer_id', customerId)
      .single();

    if (error) throw error;
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};