const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  try {
    await pool.query(`
      ALTER TABLE saved_maps ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;
    `);

    console.log("Coluna is_favorite adicionada com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("Erro ao alterar tabela:", error);
    process.exit(1);
  }
}

run();
