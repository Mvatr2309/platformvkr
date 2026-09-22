import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      profileCompleted: boolean;
      /** FR-08: у пользователя есть карточка эксперта, то есть роль эксперта */
      isExpert: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    profileCompleted: boolean;
    isExpert: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    id: string;
    profileCompleted: boolean;
    isExpert: boolean;
  }
}
