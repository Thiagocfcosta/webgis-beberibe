import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

// Busca o histórico de exportações
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'admin' || session.user.role === 'Administrador';
    
    let res;
    if (isAdmin) {
      // Admin vê tudo, com o email do usuário e a role que gerou
      res = await pool.query(`
        SELECT e.id, e.map_title, e.config_json, e.exported_at, u.email as user_email, u.role as user_role
        FROM export_logs e
        JOIN users u ON e.user_id = u.id
        ORDER BY e.exported_at DESC LIMIT 100
      `);
    } else {
      // Usuário normal vê apenas os dele
      res = await pool.query(
        'SELECT id, map_title, config_json, exported_at FROM export_logs WHERE user_id = $1 ORDER BY exported_at DESC LIMIT 50',
        [session.user.id]
      );
    }

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar logs de exportação:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

// Salva um novo log de exportação
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { map_title, config_json } = body;

    if (!map_title || !config_json) {
      return NextResponse.json({ error: 'Título do mapa e configurações são obrigatórios' }, { status: 400 });
    }

    const res = await pool.query(
      'INSERT INTO export_logs (user_id, map_title, config_json) VALUES ($1, $2, $3) RETURNING id',
      [session.user.id, map_title, config_json]
    );

    return NextResponse.json({ success: true, logId: res.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error('Erro ao salvar log de exportação:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
