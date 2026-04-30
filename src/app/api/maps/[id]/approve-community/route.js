import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

// Altera o status de aprovação de um projeto para a comunidade
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'Administrador')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status } = body; // 'APPROVED' ou 'REJECTED'

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    const checkRes = await pool.query('SELECT id FROM saved_maps WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    const approved_by = session.user.email || session.user.name || 'Admin';

    await pool.query(
      'UPDATE saved_maps SET community_status = $1, approved_by = $2 WHERE id = $3', 
      [status, approved_by, id]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Erro ao aprovar projeto para comunidade:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
