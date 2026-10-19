import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const { view } = await searchParams;
  return <Dashboard initialView={view} />;
}
