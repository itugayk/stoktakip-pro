// NextAuth type augmentation — add company/role/fullName to session + JWT.
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      fullName: string;
      companyId: string;
      role: "admin" | "manager" | "warehouse_staff" | "viewer";
      name?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    fullName?: string;
    companyId?: string;
    role?: "admin" | "manager" | "warehouse_staff" | "viewer";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    companyId?: string;
    role?: string;
    fullName?: string;
  }
}
