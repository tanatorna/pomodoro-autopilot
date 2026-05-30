import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Optional Google sign-in (JWT session → ไม่ต้องมี Auth Session table)
// roomId ของ user อ่านสดจาก DB ทุกครั้งใน session callback → claim ห้องแล้วเห็นผลทันที
export const { handlers, signIn, signOut, auth } = NextAuth({
  // prisma client เป็น generator ใหม่ (prisma-client) — cast ให้เข้ากับ type ของ adapter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = (user as { id?: string }).id;
      return token;
    },
    async session({ session, token }) {
      const uid = token.uid as string | undefined;
      if (uid && session.user) {
        session.user.id = uid;
        const u = await prisma.user.findUnique({
          where: { id: uid },
          select: { roomId: true },
        });
        session.user.roomId = u?.roomId ?? null;
      }
      return session;
    },
  },
});
