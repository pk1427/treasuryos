import { Suspense } from "react";
import { V1Overview } from "./v1-overview";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <V1Overview />
    </Suspense>
  );
}
