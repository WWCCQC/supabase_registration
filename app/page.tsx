import dynamic from "next/dynamic";
// โหลดแบบ client-only
const TechBrowser = dynamic(() => import("@/components/TechBrowser"), { ssr: false });

export default function Page() {
  return <TechBrowser />;
}
