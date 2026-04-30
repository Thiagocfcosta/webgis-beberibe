import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

// Busca os mapas compartilhados de toda a equipe
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Retorna todos os projetos onde is_shared = true, incluindo o email de quem criou
    const res = await pool.query(`
      SELECT 
        s.id, s.title, s.description, s.config_json, s.created_at, s.folder_name, s.is_shared,
        u.email as owner_email, u.name as owner_name,
        EXISTS (SELECT 1 FROM map_favorites mf WHERE mf.map_id = s.id AND mf.user_id = $1) as is_favorite,
        (SELECT COUNT(*) FROM map_favorites mf WHERE mf.map_id = s.id)::int as favorites_count
      FROM saved_maps s
      JOIN users u ON s.user_id = u.id
      WHERE s.is_shared = true
      ORDER BY s.created_at DESC
    `, [session.user.id]);

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar mapas compartilhados:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
