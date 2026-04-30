const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  try {
    console.log("Iniciando enriquecimento...");
    
    // Add columns if they don't exist
    await pool.query(`
      ALTER TABLE osm_roads 
      ADD COLUMN IF NOT EXISTS classe_via VARCHAR,
      ADD COLUMN IF NOT EXISTS classe_pavimento VARCHAR;
    `);

    // Update with translated groupings
    await pool.query(`
      UPDATE osm_roads SET 
        classe_via = CASE 
          WHEN highway IN ('trunk', 'trunk_link', 'primary', 'primary_link') THEN '1 - Rodovias Principais'
          WHEN highway IN ('secondary', 'secondary_link', 'tertiary', 'tertiary_link') THEN '2 - Vias Arteriais'
          WHEN highway IN ('residential', 'living_street') THEN '3 - Vias Urbanas'
          WHEN highway IN ('unclassified', 'service') THEN '4 - Vias Locais/Rurais'
          WHEN highway IN ('track', 'path', 'footway', 'pedestrian', 'busway') THEN '5 - Trilhas/Caminhos'
          ELSE '6 - Outros'
        END,
        classe_pavimento = CASE 
          WHEN surface IN ('paved', 'asphalt', 'concrete', 'paving_stones', 'cobblestone', 'sett') THEN '1 - Pavimentada'
          WHEN surface IN ('unpaved', 'dirt', 'earth', 'ground', 'sand', 'compacted', 'gravel') THEN '2 - Não Pavimentada'
          ELSE '3 - Sem Informação'
        END;
    `);

    console.log("Colunas atualizadas com sucesso!");

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
