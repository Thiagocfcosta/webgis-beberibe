import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

// Busca todos os projetos do banco de dados (Apenas Administradores)
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'Administrador')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const res = await pool.query(`
      SELECT 
        s.id, s.title, s.description, s.created_at, s.is_shared, s.folder_name,
        s.is_shared_community, s.community_status, s.approved_by,
        u.name as owner_name, u.email as owner_email, u.role as owner_role
      FROM saved_maps s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `);

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar todos os mapas no admin:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
