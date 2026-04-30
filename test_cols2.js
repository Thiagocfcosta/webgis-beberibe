const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  try {
    const juris = await pool.query('SELECT DISTINCT jurisdicao FROM rodovia_sirgas2000_23s');
    console.log("Jurisdicao:", juris.rows.map(r => r.jurisdicao));

    const sup = await pool.query('SELECT DISTINCT ds_superfi FROM rodovia_sirgas2000_23s');
    console.log("Superficie:", sup.rows.map(r => r.ds_superfi));

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
