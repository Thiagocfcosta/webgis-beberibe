import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/beberibe',
});

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@geovoto.com" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Busca o usuário no banco de dados PostGIS local
          const res = await pool.query('SELECT * FROM users WHERE email = $1', [credentials.email]);
          const user = res.rows[0];

          if (!user) {
            return null; // Usuário não encontrado
          }

          if (user.is_active === false) {
            return null; // Usuário inativado (soft delete)
          }

          // Compara a senha informada com o hash bcrypt salvo no banco
          const passwordsMatch = await bcrypt.compare(credentials.password, user.password_hash);

          if (passwordsMatch) {
            // Retorna objeto que será salvo no JWT da sessão
            return {
              id: user.id.toString(),
              name: user.name,
              email: user.email,
              role: user.role
            };
          } else {
            return null; // Senha incorreta
          }
        } catch (error) {
          console.error("Erro no processo de autorização:", error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: '/', // Vamos manter a tela inicial (onde faremos o modal customizado)
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
