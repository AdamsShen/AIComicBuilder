import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getTrialDurationDays } from "@/lib/entitlement";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.users,
      account: schema.accounts,
      session: schema.sessions,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // 邮箱+密码注册，同时支持邮箱验证码登录
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      // MVP: 打印到控制台。生产环境对接 Resend/SendGrid 等邮件服务
      console.log(`[Auth] ========================================`);
      console.log(`[Auth] Verification for: ${user.email}`);
      console.log(`[Auth] Token: ${token}`);
      console.log(`[Auth] URL: ${url}`);
      console.log(`[Auth] ========================================`);
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL as string],
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,      // refresh cookie every 24h
  },
  // 注册时自动设定试用期结束时间（TRIAL_DURATION_DAYS 环境变量控制，默认 3 天）
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const trialDays = getTrialDurationDays();
          const trialEndsAt = new Date(
            Date.now() + trialDays * 86_400_000,
          );
          return {
            data: {
              ...user,
              trialEndsAt,
            },
          };
        },
      },
    },
  },
});
