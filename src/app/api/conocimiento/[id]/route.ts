import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { borrarDocumento } from "@/lib/conocimiento";

export const dynamic = "force-dynamic";

/** Borra el documento y sus fragmentos (cascada). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const ok = await borrarDocumento(id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No encontrado" }, { status: 404 });
}
