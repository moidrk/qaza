import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { getDb } from "./db"
import { users } from "./db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { enforceEmailAndIpRateLimit } from "./lib/rate-limit"

const authDb = getDb()

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(authDb),
  providers: [
    Google({}),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).trim().toLowerCase();
        const rateLimitError = await enforceEmailAndIpRateLimit("auth:login", email, 10, 15 * 60 * 1000)
        if (rateLimitError) return null
        const user = await authDb.query.users.findFirst({
          where: eq(users.email, email)
        });

        if (!user || !user.password) return null;

        if (!user.emailVerified) {
          throw new Error("EmailNotVerified");
        }

        const isValid = await bcrypt.compare(credentials.password as string, user.password);

        if (isValid) {
          return { id: user.id, name: user.name, email: user.email }
        }
        return null
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id || token.sub) as string
      }
      return session
    }
  }
})
