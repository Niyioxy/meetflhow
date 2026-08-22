import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import type { UserRole } from "@/db/schema";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar",
        },
      },
    }),
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid profile email User.Read Calendars.ReadWrite OnlineMeetings.ReadWrite offline_access",
        },
      },
    }),
    Nodemailer({
      server: {
        host: "smtp-relay.brevo.com",
        port: 587,
        auth: {
          user: process.env.BREVO_SMTP_USER,
          pass: process.env.BREVO_SMTP_KEY,
        },
      },
      from: process.env.EMAIL_FROM || "MeetFlhow <noreply@meetflhow.com>",
    }),
  ],
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/login",
    newUser: "/onboarding/voice",
    verifyRequest: "/login/check-email",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: UserRole }).role ?? "member";
        session.user.language = (user as { language?: string }).language ?? "en";
      }
      return session;
    },
  },
  events: {
    // The adapter only persists tokens the first time an account is linked, so
    // a returning user re-consenting (e.g. to grant the calendar scope) would
    // otherwise never get their refreshed access/refresh token stored.
    async signIn({ account }) {
      if (account?.provider === "google" && account.access_token) {
        await db
          .update(accounts)
          .set({
            access_token: account.access_token,
            refresh_token: account.refresh_token ?? undefined,
            expires_at: account.expires_at,
            scope: account.scope,
            token_type: account.token_type,
            id_token: account.id_token as string | undefined,
          })
          .where(
            and(
              eq(accounts.provider, "google"),
              eq(accounts.providerAccountId, account.providerAccountId)
            )
          );
      }
      if (account?.provider === "microsoft-entra-id" && account.access_token) {
        await db
          .update(accounts)
          .set({
            access_token: account.access_token,
            refresh_token: account.refresh_token ?? undefined,
            expires_at: account.expires_at,
            scope: account.scope,
            token_type: account.token_type,
            id_token: account.id_token as string | undefined,
          })
          .where(
            and(
              eq(accounts.provider, "microsoft-entra-id"),
              eq(accounts.providerAccountId, account.providerAccountId)
            )
          );
      }
    },
  },
});
