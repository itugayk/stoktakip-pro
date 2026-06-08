import { redirect } from "next/navigation";
import { VerifyEmailClient } from "./verify-client";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/login");
  return <VerifyEmailClient token={token} />;
}
