const cron = require("node-cron");
const supabase = require("../config/supabase");

const startExpiredOnlineOrderedCleaner = () => {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("transactions")
        .update({
          order_status: "cancelled", 
          payment_status: "failed",
          rejection_reason: "Batal otomatis: Melewati batas waktu pembayaran 15 menit"
        })
        .eq("type", "online")
        .eq("order_status", "confirmed")
        .eq("payment_status", "unpaid")
        .lt("created_at", fifteenMinutesAgo)
        .select();

      if (data && data.length > 0) {
        console.log(`[CRON] ${data.length} transaksi online unpaid berhasil dibatalkan otomatis.`);
      }

      if (error) throw error;
    } catch (err) {
      console.error("[CRON ERROR] Gagal membersihkan transaksi kedaluwarsa:", err.message);
    }
  });

  console.log("🛠️  Cron Job Pembersih Transaksi Otomatis telah aktif.");
};

module.exports = { startExpiredOnlineOrderedCleaner };