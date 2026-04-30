const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', password: '1234', database: 'beberibe', host: 'localhost', port: 5432 });

async function checkLayers() {
  console.log("Iniciando auditoria robótica de camadas...");
  const res = await pool.query("SELECT f_table_name FROM geometry_columns WHERE f_table_schema = 'public'");
  
  for (const row of res.rows) {
    const table = row.f_table_name;
    try {
      const bounds = await pool.query(`SELECT MAX(ST_XMax(geom)) as maxx, MIN(ST_XMin(geom)) as minx FROM ${table}`);
      const maxx = bounds.rows[0].maxx;
      const minx = bounds.rows[0].minx;
      
      let status = 'OK (Lat/Lon)';
      if (maxx === null || minx === null) {
        status = 'EMPTY_TABLE';
      } else if (maxx > 180 || minx < -180 || maxx < -180 || minx > 180) {
        status = 'INVALID_PROJECTION (UTM/SIRGAS2000)';
      }
      
      console.log(`${table.padEnd(65)} | ${status.padEnd(35)} | ${minx ? minx.toFixed(2) : 'null'} to ${maxx ? maxx.toFixed(2) : 'null'}`);
    } catch(e) {
      console.log(`${table.padEnd(65)} | ERROR: ${e.message}`);
    }
  }
  pool.end();
}
checkLayers();
