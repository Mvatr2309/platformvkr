import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Защита от запуска без секрета: NextAuth подписывает JWT этим ключом,
// при пустом/слабом значении сессии становятся подделываемыми.
const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
if (!secret) {
  throw new Error(
    "NEXTAUTH_SECRET (или AUTH_SECRET) не задан. Сгенерируйте: `openssl rand -base64 32` и положите в .env"
  );
}
if (secret.length < 32) {
  console.warn(
    `[auth] NEXTAUTH_SECRET длиной ${secret.length} символов — рекомендуется ≥ 32. Сгенерируйте новый: openssl rand -base64 32`
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          profileCompleted: user.profileCompleted,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.profileCompleted = user.profileCompleted;
      }
      // При update сессии — перечитываем profileCompleted из БД
      if (trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { profileCompleted: true, name: true },
        });
        if (dbUser) {
          token.profileCompleted = dbUser.profileCompleted;
          token.name = dbUser.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.profileCompleted = token.profileCompleted as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
