import NextAuth, { NextAuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import db from "@/lib/db";

// Extend next-auth session and JWT types to support roles and tenant isolation
declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    tenantId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      tenantId?: string | null;
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    tenantId?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@lotre.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Find user in database
        const user = await db.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user) {
          return null;
        }

        // A REAL app should use bcrypt/argon2 here.
        // For development rapid-onboarding, we support plain text match.
        if (user.passwordHash !== credentials.password) {
          return null;
        }

        let tenantId: string | null = null;

        // Auto-resolve Tenant ID based on user role
        if (user.role === "TENANT_ADMIN") {
          const tenant = await db.tenant.findFirst({
            where: { ownerId: user.id }
          });
          if (tenant) {
            tenantId = tenant.id;
          }
        } else if (user.role === "MEMBER") {
          const anggota = await db.anggota.findUnique({
            where: { userId: user.id }
          });
          if (anggota) {
            tenantId = anggota.tenantId;
          }
        }

        return {
          id: user.id,
          name: user.namaLengkap,
          email: user.email,
          role: user.role,
          tenantId: tenantId
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "super-secret-lotre-saas-key-12345",
  pages: {
    signIn: "/auth/login",
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
