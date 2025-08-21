// บังคับให้เพจนี้เป็น dynamic และไม่ใช้ cache ของ Next/Vercel
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import dynamic from "next/dynamic";

// โหลดแบบ client-only
const TechBrowser = dynamic(() => import("@/components/TechBrowser"), { ssr: false });

export default function Page() {
  return <TechBrowser />;
}
