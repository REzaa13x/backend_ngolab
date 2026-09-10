import { PoolConnection } from "mysql2/promise";
import { db } from "../db/db.js";

/**
 * Memproses pemberian koin berdasarkan total harga dan coin_reward_rate di app_settings
 */
export async function processLoyaltyPoints(
  connection: PoolConnection,
  userId: string | null,
  userName: string,
  invoiceNumber: string,
  totalPrice: number
): Promise<number> {
  if (!userId) return 0;

  try {
    // Ambil rate dari app_settings
    const [settingsRows]: any = await connection.query(
      "SELECT value FROM app_settings WHERE `key` = 'coin_reward_rate' LIMIT 1"
    );
    
    // Default 0.001 (1 koin tiap Rp 1000) jika belum diset
    let rate = 0.001; 
    if (settingsRows.length > 0 && settingsRows[0].value !== null && settingsRows[0].value !== '') {
      const parsed = parseFloat(settingsRows[0].value);
      if (!isNaN(parsed)) {
        rate = parsed;
      }
    }

    const earnedCoins = Math.floor(totalPrice * rate);

    if (earnedCoins > 0) {
      await connection.query("UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?", [earnedCoins, userId]);
      
      await connection.query(
        "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'earn', ?, ?)",
        [`ct-${Date.now()}-${Math.floor(Math.random()*1000)}`, userId, userName, earnedCoins, `Reward dari transaksi ${invoiceNumber}`]
      );
    }
    
    return earnedCoins;
  } catch (error) {
    console.error("Gagal memproses loyalty points:", error);
    return 0;
  }
}
