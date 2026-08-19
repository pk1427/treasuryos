import { Suspense } from "react";
import { V1Dashboard } from "./v1-dashboard";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <V1Dashboard />
    </Suspense>
  );
}
