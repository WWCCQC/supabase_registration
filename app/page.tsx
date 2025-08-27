// บังคับให้เพจนี้ไม่ถูกแคช
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import NextDynamic from "next/dynamic";

// โหลด component แบบ client-only (เปลี่ยนชื่อ import เป็น NextDynamic)
const TechBrowser = NextDynamic(() => import("@/components/TechBrowser"), { ssr: false });

export default function Page() {
  return (
    <div style={{ padding: 24 }}>
      <TechBrowser />
    </div>
  );
}
