import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

// Busca as pastas do usuário
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const res = await pool.query(
      'SELECT id, name, created_at FROM workspace_folders WHERE user_id = $1 ORDER BY name ASC',
      [session.user.id]
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar pastas:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// Cria uma nova pasta
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nome da pasta é obrigatório' }, { status: 400 });
    }

    const folderName = name.trim();

    // Inserir, ignorando se já existir
    const res = await pool.query(
      'INSERT INTO workspace_folders (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING RETURNING id',
      [session.user.id, folderName]
    );

    return NextResponse.json({ success: true, folder: { name: folderName } }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar pasta:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
