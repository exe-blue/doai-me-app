import { redirect } from "next/navigation";

/**
 * Root path: show landing.
 * Operations home is at /dashboard.
 */
export default function RootPage() {
  redirect("/landing");
}
