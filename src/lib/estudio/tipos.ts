/** Tipos compartidos entre la API del Estudio y su pantalla. */

export interface PerfilResumen {
  slug: string;
  nombre: string;
  descripcion: string;
  colorPrimario: string;
  colorSidebar: string;
  icono: string | null;
  activo: boolean;
  /** Errores de esquema del config.json; vacio si es valido. */
  errores: string[];
}

export interface ModuloDisponible {
  nombre: string;
  titulo: string;
  descripcion: string;
}

export interface PlantillaResumen {
  clave: string;
  titulo: string;
  descripcion: string;
}

export interface EstadoEstudio {
  perfiles: PerfilResumen[];
  /** Perfil que carga config/cliente.ts; null si el archivo esta escrito a mano. */
  activo: string | null;
  clienteManual: boolean;
  erroresConfigCargada: string[];
  plantillas: PlantillaResumen[];
  modulos: ModuloDisponible[];
}

export interface ResultadoAplicar {
  /** Cambiaron los modulos activos: hace falta migrar y reiniciar (FR-010). */
  modulosCambiaron: boolean;
  pipeline: { creadas: number; actualizadas: number; conservadas: number; borradas: number } | null;
  avisos: string[];
}
