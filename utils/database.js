// utils/database.js
import mysql from 'mysql2/promise';
import { DateTime } from 'luxon';
import { logger } from './logger.js';

// Configuration de la connexion
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'winr8te_rust',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Pool de connexions
let pool;

// Initialiser le pool
export function initDatabase() {
  pool = mysql.createPool(dbConfig);
  logger.success('Database pool initialized');
}

// Obtenir une connexion
export async function getDbConnection() {
  if (!pool) {
    initDatabase();
  }
  return await pool.getConnection();
}

// Fermer le pool
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    logger.info('Database pool closed');
  }
}

// Récupérer la seed active
export async function getActiveSeed() {
  const connection = await getDbConnection();
  try {
    const [rows] = await connection.execute(
      'SELECT current_seed, map_size, next_wipe_date, wipe_type FROM active_seed WHERE id = 1'
    );
    return rows[0] || null;
  } catch (error) {
    logger.error('Error fetching active seed', { error: error.message });
    throw error;
  } finally {
    await connection.release();
  }
}

// --- NOUVELLE FONCTION ---
export async function saveWinningSeed(seed, wipeDate, voteData, voteCounts) {
  const connection = await getDbConnection();

  try {
    await connection.execute(
      `INSERT INTO active_seed (id, current_seed, map_size, next_wipe_date, wipe_type)
       VALUES (1, ?, ?, ?, 'biweekly')
       ON DUPLICATE KEY UPDATE
       current_seed = VALUES(current_seed),
       next_wipe_date = VALUES(next_wipe_date),
       updated_at = CURRENT_TIMESTAMP`,
      [seed.toString(), voteData.mapSize || 3500, DateTime.fromJSDate(wipeDate).toFormat('yyyy-MM-dd HH:mm:ss')]
    );

    await connection.execute(
      `INSERT INTO vote_history
       (wipe_date, wipe_type, winner_seed, seed1, seed2, seed3, votes1, votes2, votes3, total_votes)
       VALUES (?, 'biweekly', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        DateTime.fromJSDate(wipeDate).toFormat('yyyy-MM-dd HH:mm:ss'),
        seed.toString(),
        voteData.seeds[0].toString(),
        voteData.seeds[1].toString(),
        voteData.seeds[2].toString(),
        voteCounts[0],
        voteCounts[1],
        voteCounts[2],
        voteCounts.reduce((a, b) => a + b, 0)
      ]
    );

    logger.success("Winning seed saved to database", { seed, wipeDate });
  } catch (error) {
    logger.error("Error saving winning seed", { error: error.message });
    throw error;
  } finally {
    await connection.release();
  }
}

// Tester la connexion
export async function testDatabaseConnection() {
  try {
    const connection = await getDbConnection();
    await connection.ping();
    await connection.release();
    logger.success('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error: error.message });
    return false;
  }
}
