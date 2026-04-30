const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  const query = `
    SELECT f_table_name, f_geometry_column, srid, type 
    FROM geometry_columns 
    WHERE f_table_name IN (
      'beberibe_limite_municipal_2025', 
      'rodovia_sirgas2000_23s', 
      'quilombos_sab_incra', 
      'i3geomap_uc_estadual', 
      'i3geomap_uc_federal', 
      'i3geomap_acudes_monitorados', 
      'i3geomap_corpos_d_agua'
    );
  `;
  try {
    const res = await pool.query(query);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
