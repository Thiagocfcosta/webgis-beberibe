import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

// Busca os estilos salvos
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const res = await pool.query(
      'SELECT id, name, style_json, created_at FROM saved_styles WHERE user_id = $1 ORDER BY name ASC',
      [session.user.id]
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar estilos:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// Salva um novo estilo
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { name, style_json } = body;

    if (!name || !style_json) {
      return NextResponse.json({ error: 'Nome e estilo são obrigatórios' }, { status: 400 });
    }

    const res = await pool.query(
      'INSERT INTO saved_styles (user_id, name, style_json) VALUES ($1, $2, $3) RETURNING id',
      [session.user.id, name, style_json]
    );

    return NextResponse.json({ success: true, styleId: res.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error('Erro ao salvar estilo:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
