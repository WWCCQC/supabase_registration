"use client";

import NextDynamic from "next/dynamic";
import SidebarLayout from "@/components/common/SidebarLayout";

// middleware.ts guards "/" (redirects to /login without a valid token), so no client-side auth gate here.
const TechBrowser = NextDynamic(() => import("@/components/TechBrowser"), {
  ssr: false,
  loading: () => (
    <div style={{ padding: "60px 20px", textAlign: "center", color: "#666", fontSize: 18 }}>
      กำลังโหลดข้อมูลระบบ...
    </div>
  ),
});

export default function Page() {
  return (
    <SidebarLayout activeTab="TOL" themeToggle>
      <TechBrowser />
    </SidebarLayout>
  );
}
