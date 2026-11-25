/** Pairs workgroup heads with their members for the "Technician by depot" view. */

export type DepotTechnicianRow = {
  national_id: string | null;
  tech_id: string | null;
  full_name: string | null;
  workgroup_status: string | null;
  work_type: string | null;
  provider: string | null;
  RBM: string | null;
  CBM: string | null;
  province: string | null;
  depot_name: string | null;
  depot_code: string | null;
  team_name: string | null;
  division: string | number | null;
  doc_tech_card_url: string | null;
};

export type DepotPerson = { techId: string | null; name: string; photo: string | null };

export type DepotWorkgroup = {
  id: string;
  rbm: string;
  cbm: string;
  province: string;
  depot: string;
  depotCode: string;
  workType: string;
  teamName: string;
  provider: string;
  division: string;
  /** null when the members' depot + division has no head they can be paired with. */
  head: DepotPerson | null;
  members: DepotPerson[];
};

export type DepotWorkgroupsResponse = {
  workgroups: DepotWorkgroup[];
  totals: { workgroups: number; heads: number; members: number; unpairedMembers: number; depots: number };
};

// Starts-with check tolerates the broken-encoding variants of "หัวหน้า" seen elsewhere in the data.
const isHead = (r: DepotTechnicianRow) => String(r.workgroup_status ?? "").trim().startsWith("ห");
const text = (v: unknown) => (v == null ? "" : String(v).trim());

function toPerson(r: DepotTechnicianRow): DepotPerson {
  return { techId: r.tech_id, name: text(r.full_name) || "—", photo: text(r.doc_tech_card_url) || null };
}

function toWorkgroup(r: DepotTechnicianRow, id: string, head: DepotPerson | null, cbm: string): DepotWorkgroup {
  return {
    id,
    rbm: text(r.RBM),
    cbm,
    province: text(r.province),
    depot: text(r.depot_name),
    depotCode: text(r.depot_code),
    workType: text(r.work_type),
    teamName: text(r.team_name),
    provider: text(r.provider),
    division: text(r.division),
    head,
    members: [],
  };
}

/**
 * A member belongs to the head with the same depot and division. When that depot + division has several
 * heads, the member goes to the head with the same team_name. Members that still match no single head are
 * kept in an "unpaired" workgroup per depot + division (+ team_name) so nobody disappears from the list.
 */
export function buildDepotWorkgroups(rows: DepotTechnicianRow[], cbmLabel: (cbm: string) => string): DepotWorkgroupsResponse {
  const byKey = new Map<string, DepotTechnicianRow[]>();
  for (const r of rows) {
    const key = `${text(r.depot_name)}|${text(r.division)}`;
    const list = byKey.get(key);
    if (list) list.push(r);
    else byKey.set(key, [r]);
  }

  const workgroups: DepotWorkgroup[] = [];
  let unpairedMembers = 0;

  for (const [key, group] of byKey) {
    const heads = group.filter(isHead);
    const members = group.filter((r) => !isHead(r));
    const headGroups = heads.map((h, i) => toWorkgroup(h, `${key}|${h.national_id ?? h.tech_id ?? i}`, toPerson(h), cbmLabel(text(h.CBM))));
    const unpaired = new Map<string, DepotWorkgroup>();

    for (const m of members) {
      const target =
        headGroups.length === 1
          ? headGroups[0]
          : (() => {
              const sameTeam = headGroups.filter((g) => g.teamName === text(m.team_name));
              return sameTeam.length === 1 ? sameTeam[0] : null;
            })();
      if (target) {
        target.members.push(toPerson(m));
        continue;
      }
      unpairedMembers++;
      const uKey = `${key}|${text(m.team_name)}`;
      let u = unpaired.get(uKey);
      if (!u) {
        u = toWorkgroup(m, `${uKey}|unpaired`, null, cbmLabel(text(m.CBM)));
        unpaired.set(uKey, u);
      }
      u.members.push(toPerson(m));
    }

    workgroups.push(...headGroups, ...unpaired.values());
  }

  const th = (a: string, b: string) => a.localeCompare(b, "th");
  workgroups.sort(
    (a, b) =>
      th(a.rbm, b.rbm) || th(a.cbm, b.cbm) || th(a.province, b.province) || th(a.depot, b.depot) ||
      th(a.workType, b.workType) || th(a.teamName, b.teamName) || th(a.head?.name ?? "", b.head?.name ?? ""),
  );

  const heads = workgroups.filter((w) => w.head).length;
  return {
    workgroups,
    totals: {
      workgroups: heads,
      heads,
      members: rows.length - heads,
      unpairedMembers,
      depots: new Set(rows.map((r) => text(r.depot_name))).size,
    },
  };
}
