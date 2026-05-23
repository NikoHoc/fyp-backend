const supabase = require('../config/supabase');

//
exports.getAllMethods = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.createMethod = async (req, res) => {
  try {
    const { name, is_active } = req.body;
    const { data, error } = await supabase
      .from('payment_methods')
      .insert([{ name: name.toUpperCase(), is_active: is_active !== false }])
      .select();

    if (error) throw error;
    res.status(201).json({ status: 'success', data: data[0] });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.updateMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;
    
    const updateData = { updated_at: new Date() };
    if (name) updateData.name = name.toUpperCase();
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('payment_methods')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ status: 'success', data: data[0] });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.deleteMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ status: 'success', message: 'Metode pembayaran dihapus' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};