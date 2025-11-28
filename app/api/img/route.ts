export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";

/** สกัด id จากลิงก์ Google Drive หลายรปแบบ */
function extractDriveId(input: string): string | null {
  try {
    const u = new URL(input);
    if (!u.hostname.includes("drive.google.com")) return null;
    // ?id=XXXX
    const id1 = u.searchParams.get("id");
    if (id1) return id1;
    // /file/d/XXXX/...
    const m = u.pathname.match(/\/file\/d\/([^/]+)/) || u.pathname.match(/\/d\/([^/]+)/);
    if (m?.[1]) return m[1];
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const u = searchParams.get("u");
    const isThumb = searchParams.get("thumb") === "1";
    if (!u) return NextResponse.json({ error: "missing u" }, { status: 400 });

    let target = u;

    // ถาเปน Google Drive แปลงเปน endpoint ทใหไฟลรปแน 
    const id = extractDriveId(u);
    if (id) {
      target = isThumb
        ? `https://drive.google.com/thumbnail?id=${id}`              // thumbnail
        : `https://drive.google.com/uc?export=view&id=${id}`;        // full image
    }

    const res = await fetch(target, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: `fetch failed ${res.status}` }, { status: 502 });
    }

    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = await res.arrayBuffer();
    return new Response(Buffer.from(buf), {
      headers: {
        "content-type": ct,
        "cache-control": "public, max-age=300"
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown" }, { status: 500 });
  }
}
