const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%a_ude%' OR table_name LIKE '%acude%'");
    console.log("Tables:", res.rows.map(r => r.table_name));
    
    // Deletar as tabelas redundantes
    await pool.query("DROP TABLE IF EXISTS beberibe_a_ude_planejado");
    await pool.query("DROP TABLE IF EXISTS beberibe_acude_planejado");
    
    console.log("Tabelas redundantes (beberibe_a_ude_planejado e beberibe_acude_planejado) deletadas.");

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
