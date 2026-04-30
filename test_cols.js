const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'rodovia_sirgas2000_23s'
    `);
    console.log("Colunas:", res.rows.map(r => r.column_name).join(', '));
    
    const sample = await pool.query('SELECT * FROM rodovia_sirgas2000_23s LIMIT 3');
    console.log("Valores ds_jurisd:", sample.rows.map(r => r.ds_jurisd));
    console.log("Valores ds_revesti:", sample.rows.map(r => r.ds_revesti));
    console.log("Valores ds_operaca:", sample.rows.map(r => r.ds_operaca));

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
