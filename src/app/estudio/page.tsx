import { notFound, redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/team";
import { estudioDisponible } from "@/lib/estudio/disponible";
import { EstudioApp } from "@/components/estudio/EstudioApp";

export const dynamic = "force-dynamic";

export const metadata = { title: "Estudio" };

/**
 * Estudio: adaptar el CRM a cada cliente con perfiles y un asistente guiado. Solo admin
 * y solo fuera de produccion (FR-003); en una instancia desplegada no existe.
 * Ver specs/nucleo/12-estudio.md.
 */
export default async function EstudioPage() {
  if (!estudioDisponible()) notFound();
  const member = await getCurrentMember();
  if (!member) redirect("/sin-acceso");
  if (member.role !== "admin") notFound();

  return <EstudioApp />;
}
