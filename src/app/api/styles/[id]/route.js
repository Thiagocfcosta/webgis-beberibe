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

    // Verificar se o estilo existe e pertence ao usuário (ou se é admin)
    const checkRes = await pool.query('SELECT user_id FROM saved_styles WHERE id = $1', [id]);
    
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Estilo não encontrado' }, { status: 404 });
    }

    if (checkRes.rows[0].user_id.toString() !== session.user.id && session.user.role !== 'admin' && session.user.role !== 'Administrador') {
      return NextResponse.json({ error: 'Não autorizado a excluir este estilo' }, { status: 403 });
    }

    await pool.query('DELETE FROM saved_styles WHERE id = $1', [id]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Erro ao deletar estilo:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
