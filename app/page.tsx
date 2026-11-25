"use client";

import { useState } from "react";
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

const TechnicianByDepot = NextDynamic(() => import("@/components/tables/TechnicianByDepot"), { ssr: false });

const HOME_TABS = [
  { id: "summary", label: "Summary" },
  { id: "technician-by-depot", label: "Technician by depot" },
] as const;
type HomeTab = (typeof HOME_TABS)[number]["id"];

export default function Page() {
  const [activeTab, setActiveTab] = useState<HomeTab>("summary");

  const navigation = (
    <div className="navtabs" role="tablist" aria-label="หน้าหลัก">
      {HOME_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`home-tab-${tab.id}`}
          aria-selected={activeTab === tab.id}
          aria-controls={`home-panel-${tab.id}`}
          className={`navtab-item ${activeTab === tab.id ? "navtab-active" : ""}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <SidebarLayout navigation={navigation} themeToggle>
      {/* Summary stays mounted while hidden so its filters and loaded data survive tab switches. */}
      <section id="home-panel-summary" role="tabpanel" aria-labelledby="home-tab-summary" hidden={activeTab !== "summary"}>
        <TechBrowser />
      </section>
      {activeTab === "technician-by-depot" && (
        <section id="home-panel-technician-by-depot" role="tabpanel" aria-labelledby="home-tab-technician-by-depot">
          <TechnicianByDepot />
        </section>
      )}
    </SidebarLayout>
  );
}
