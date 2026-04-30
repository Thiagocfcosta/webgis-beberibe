const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe'
});

async function run() {
  try {
    // 1. Criar a tabela workspace_folders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workspace_folders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, name)
      )
    `);
    
    // 2. Extrair pastas únicas já existentes em saved_maps e inserir na nova tabela
    // Isso garante que não perdemos o nome de pastas antigas.
    await pool.query(`
      INSERT INTO workspace_folders (user_id, name)
      SELECT DISTINCT user_id, folder_name
      FROM saved_maps
      WHERE folder_name IS NOT NULL AND folder_name != ''
      ON CONFLICT (user_id, name) DO NOTHING
    `);

    // 3. Inserir pasta Raiz padrão para todos os usuários que têm mapas
    await pool.query(`
      INSERT INTO workspace_folders (user_id, name)
      SELECT DISTINCT user_id, 'Raiz'
      FROM saved_maps
      ON CONFLICT (user_id, name) DO NOTHING
    `);

    console.log("Tabela workspace_folders criada e populada com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("Erro ao alterar tabela:", error);
    process.exit(1);
  }
}

run();
