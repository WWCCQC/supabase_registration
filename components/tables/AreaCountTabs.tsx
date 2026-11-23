"use client";

import React from "react";
import { ClipboardList, UsersRound } from "lucide-react";
import AreaCountTable from "./AreaCountTable";
import type { AreaCounts } from "@/lib/workTypes";
import styles from "./AreaCountTabs.module.css";

type Props = { data: AreaCounts | null; placeholder: React.ReactNode };

const TABS = [
  { id: "workgroups", label: "จำนวนกองงาน", caption: "จำนวนกองงานช่าง (กองงาน) แยกตามพื้นที่", Icon: ClipboardList },
  { id: "technicians", label: "จำนวนช่าง (คน)", caption: "จำนวนช่าง (คน) แยกตามพื้นที่", Icon: UsersRound },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** One card for both area tables, switched by tabs (ARIA tabs pattern, arrow keys move between tabs). */
export default function AreaCountTabs({ data, placeholder }: Props) {
  const [active, setActive] = React.useState<TabId>("workgroups");
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const baseId = React.useId();
  const current = TABS.find((t) => t.id === active)!;

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length];
    setActive(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <section className={styles.card} aria-label="ตารางแยกตามพื้นที่">
      <div className={styles.header}>
        <h3>{current.caption}</h3>
        <div className={styles.tabs} role="tablist" aria-label="เลือกตาราง">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[t.id] = el; }}
              type="button"
              role="tab"
              id={`${baseId}-${t.id}-tab`}
              aria-selected={active === t.id}
              aria-controls={`${baseId}-${t.id}-panel`}
              tabIndex={active === t.id ? 0 : -1}
              className={active === t.id ? styles.tabActive : styles.tab}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <t.Icon size={14} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id={`${baseId}-${active}-panel`} aria-labelledby={`${baseId}-${active}-tab`}>
        {data ? <AreaCountTable data={data[active]} caption={current.caption} /> : placeholder}
      </div>
    </section>
  );
}
