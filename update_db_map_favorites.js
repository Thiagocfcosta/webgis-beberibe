const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log("Criando tabela map_favorites...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS map_favorites (
        map_id INTEGER REFERENCES saved_maps(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (map_id, user_id)
      );
    `);

    console.log("Migrando favoritos antigos...");
    await client.query(`
      INSERT INTO map_favorites (map_id, user_id)
      SELECT id, user_id FROM saved_maps WHERE is_favorite = true
      ON CONFLICT DO NOTHING;
    `);

    console.log("Removendo coluna is_favorite antiga...");
    await client.query(`
      ALTER TABLE saved_maps DROP COLUMN IF EXISTS is_favorite;
    `);

    await client.query('COMMIT');
    console.log("Migração de favoritos concluída com sucesso!");
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Erro na migração:", error);
    process.exit(1);
  } finally {
    client.release();
  }
}

run();
