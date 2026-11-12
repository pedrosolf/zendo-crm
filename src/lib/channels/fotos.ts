import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";

/**
 * Fotos que mando el cliente por WhatsApp en una conversacion, para adjuntarlas a algo
 * (un reclamo, un pedido). El mensaje guarda el webhook entero en `raw_payload`; la URL
 * del adjunto es del media de Zernio y se baja con su clave (ver descargarMedio).
 */

export interface FotoRecibida {
  url: string;
  mime: string | null;
  recibidaEn: Date;
  /** Texto que acompanio la foto, si hubo. */
  epigrafe: string | null;
}

interface AdjuntoCrudo {
  url?: string;
  type?: string;
  payload?: { mimeType?: string };
}

/** Las fotos entrantes de la conversacion desde `desde`, la mas reciente primero. */
export async function fotosRecibidas(conversationId: string, desde: Date): Promise<FotoRecibida[]> {
  const filas = await db
    .select({ raw: messages.rawPayload, createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.direction, "in"),
        eq(messages.type, "image"),
        gte(messages.createdAt, desde)
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(10);

  const fotos: FotoRecibida[] = [];
  for (const f of filas) {
    const msg = (f.raw as { message?: { text?: string | null; attachments?: AdjuntoCrudo[] } } | null)?.message;
    for (const a of msg?.attachments ?? []) {
      if ((a.type ?? "").toLowerCase() !== "image" || !a.url) continue;
      fotos.push({
        url: a.url,
        mime: a.payload?.mimeType?.split(";")[0].trim() ?? null,
        recibidaEn: f.createdAt,
        epigrafe: msg?.text?.trim() || null,
      });
    }
  }
  return fotos;
}
