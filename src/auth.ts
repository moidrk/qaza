import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "./db"
import { users } from "./db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { isBlockedEmail } from "./lib/auth-guards"

type GoogleProfile = {
  email?: string | null
  email_verified?: boolean | null
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
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
        
        const user = await db.query.users.findFirst({ 
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
  events: {
    async linkAccount({ user, account, profile }) {
      const googleProfile = profile as GoogleProfile | undefined
      if (account.provider === "google" && googleProfile?.email_verified === true && user.id) {
        await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, user.id))
      }
    },
  },
  callbacks: {
    async signIn({ account, profile }) {
      const googleProfile = profile as GoogleProfile | undefined
      if (account?.provider === "google") {
        if (!googleProfile?.email || googleProfile.email_verified !== true) {
          return false
        }

        if (isBlockedEmail(googleProfile.email)) {
          return false
        }
      }

      return true
    },
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
