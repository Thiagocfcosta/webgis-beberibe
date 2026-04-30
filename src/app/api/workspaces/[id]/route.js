import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const checkRes = await pool.query('SELECT user_id FROM saved_maps WHERE id = $1', [id]);
    
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    if (checkRes.rows[0].user_id.toString() !== session.user.id && session.user.role !== 'admin' && session.user.role !== 'Administrador') {
      return NextResponse.json({ error: 'Não autorizado a excluir este projeto' }, { status: 403 });
    }

    await pool.query('DELETE FROM saved_maps WHERE id = $1', [id]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Erro ao deletar projeto:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, description, config_json, folder_name } = body;

    const checkRes = await pool.query('SELECT user_id, config_json FROM saved_maps WHERE id = $1', [id]);
    
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    if (checkRes.rows[0].user_id.toString() !== session.user.id && session.user.role !== 'admin' && session.user.role !== 'Administrador') {
      return NextResponse.json({ error: 'Não autorizado a editar este projeto' }, { status: 403 });
    }

    const folder = folder_name && folder_name.trim() !== '' ? folder_name.trim() : 'Raiz';

    // Atualiza o projeto principal
    await pool.query(
      'UPDATE saved_maps SET title = $1, description = $2, config_json = $3, folder_name = $4 WHERE id = $5',
      [title, description, config_json, folder, id]
    );

    // Salva a nova versão no histórico
    if (config_json) {
      await pool.query(
        'INSERT INTO map_versions (map_id, config_json) VALUES ($1, $2)',
        [id, config_json]
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Erro ao editar projeto:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
