import type { TableNames } from "@/convex/_generated/dataModel";

/* -------------------------------------------------------------------------- */
/* Catálogo unificado (Módulo 2.2)                                              */
/* -------------------------------------------------------------------------- */

export type ItemType =
  | "bien_reparacion"
  | "bien_reparacion_na"
  | "si_no"
  | "si_no_na"
  | "select"
  | "text"
  | "textarea"
  | "readonly";

export type ReadonlyUserContext = {
  name?: string | null;
  email?: string | null;
};

/** Solo `readonly`: cómo obtener el texto si aún no hay valor persistido (serializable; sin funciones). */
export type ReadonlySource = "inspector_name" | "timestamp";

export interface SectionItem {
  key: string;
  label: string;
  type: ItemType;
  subtitle?: string;
  showObservation?: boolean;
  /** Si/no: usar textarea en lugar de input para observaciones. */
  observationMultiline?: boolean;
  observationPlaceholder?: string;
  showPhotos?: boolean;
  photoLabel?: string;
  options?: string[];
  placeholder?: string;
  /** Solo `readonly`: ver `ReadonlySource`. */
  readonlySource?: ReadonlySource;
  /**
   * Sí/No con pregunta explícita de presencia de defecto (ej. «¿Presencia de herrumbre?»).
   * **Sí** = hallazgo, **No** = sin defecto (OK). Misma regla que el default tras el fix de hallazgos.
   */
  positiveWhenNo?: boolean;
  /**
   * Sí/No donde **No** = falla o ausencia de algo deseable (ej. sin llanta de repuesto,
   * temperatura no normal, líneas no congruentes). **Sí** = OK.
   */
  findingWhenNo?: boolean;
  /**
   * Visible solo si otro campo del mismo formulario tiene uno de estos valores
   * (p. ej. ítems de Tracción cuando tipo = 4WD o 4x4).
   */
  visibleWhen?: {
    field: string;
    values: string[];
  };
}

export interface SectionConfig {
  id: string;
  name: string;
  table: TableNames;
  /** Nombre del icono en `lucide-react` (PascalCase). */
  icon: string;
  subtitle?: string;
  items: SectionItem[];
  conditionalOn?: {
    field: "transmissionType";
    /** p. ej. 4WD: `automatico_4wd` | `manual_4wd` */
    values: string[];
  };
}

export const SECTIONS_CONFIG: SectionConfig[] = [
  {
    id: "motor",
    name: "Sistema de motor",
    table: "section_motor",
    icon: "Cog",
    items: [
      {
        key: "nivel_aceite",
        label: "Nivel de aceite",
        type: "bien_reparacion_na",
      },
      {
        key: "aspecto_aceite",
        label: "Aspecto de aceite",
        type: "bien_reparacion_na",
        showObservation: true,
        observationPlaceholder: "Observaciones sobre el aspecto...",
      },
      {
        key: "contaminacion_interna",
        label: "Contaminación interna",
        type: "si_no_na",
        positiveWhenNo: true,
        showObservation: true,
        showPhotos: true,
        observationPlaceholder: "Especifique contaminación...",
        photoLabel: "Agregar fotos",
      },
      {
        key: "fajas_accesorios",
        label: "Fajas de accesorios",
        type: "bien_reparacion_na",
        showPhotos: true,
        photoLabel: "Tomar 1 Foto",
      },
      {
        key: "fuga_aceite",
        label: "Fuga de aceite",
        type: "si_no_na",
        positiveWhenNo: true,
        showPhotos: true,
        photoLabel: "Subir múltiples fotos",
      },
      {
        key: "indicios_reparacion_prematura",
        label: "Reparación prematura",
        type: "si_no_na",
        showObservation: true,
        observationMultiline: true,
        observationPlaceholder: "Detalles de la reparación...",
      },
      {
        key: "estado_radiador_condensador",
        label: "Radiador y condensador",
        type: "bien_reparacion_na",
      },
      {
        key: "fugas_coolant",
        label: "Fugas de coolant",
        type: "si_no_na",
        positiveWhenNo: true,
        showObservation: true,
        showPhotos: true,
        observationPlaceholder: "Ubicación de la fuga...",
        photoLabel: "Múltiples fotos",
      },
      {
        key: "indicios_malas_manipulaciones",
        label: "Malas manipulaciones",
        type: "si_no_na",
        showObservation: true,
        observationMultiline: true,
        observationPlaceholder: "Observaciones de manipulación...",
      },
      {
        key: "ruidos_anormales",
        label: "Ruidos anormales",
        type: "si_no_na",
        showObservation: true,
        observationPlaceholder: "Describa el ruido...",
      },
      {
        key: "presencia_humo",
        label: "Presencia de humo",
        type: "si_no_na",
        positiveWhenNo: true,
        showObservation: true,
        observationPlaceholder: "Color del humo y frecuencia...",
      },
      {
        key: "presencia_herrumbre_motor",
        label: "¿Presencia de herrumbre?",
        type: "si_no_na",
        positiveWhenNo: true,
      },
    ],
  },
  {
    id: "transmision",
    name: "Transmisión",
    table: "section_transmision",
    icon: "GitBranch",
    items: [
      {
        key: "aspecto_liquido_transmision",
        label: "Aspecto de líquido de transmisión",
        type: "bien_reparacion_na",
      },
      {
        key: "fugas_aceite",
        label: "Fugas de aceite",
        type: "si_no_na",
        positiveWhenNo: true,
        showPhotos: true,
      },
      {
        key: "estado_botas_eje",
        label: "Estado de botas de eje",
        type: "bien_reparacion_na",
        subtitle: "Integridad de guardapolvos",
      },
      {
        key: "aspecto_liquido_embrague",
        label: "Aspecto de líquido de embrague",
        type: "bien_reparacion_na",
      },
      {
        key: "fugas_liquido_embrague",
        label: "Fugas de líquido de embrague",
        type: "si_no_na",
        positiveWhenNo: true,
      },
      {
        key: "funcionamiento_embrague",
        label: "Funcionamiento de embrague",
        type: "bien_reparacion_na",
      },
      {
        key: "funcionamiento_palanca",
        label: "Funcionamiento de palanca",
        type: "bien_reparacion_na",
      },
      {
        key: "ruidos_anormales",
        label: "Ruidos anormales",
        type: "si_no_na",
        showObservation: true,
        observationPlaceholder: "Observaciones de ruido...",
      },
      {
        key: "funcionamiento_cambio_velocidades",
        label: "Funcionamiento cambio de velocidades",
        type: "bien_reparacion_na",
      },
    ],
  },
  {
    id: "electrico",
    name: "Sistema eléctrico",
    table: "section_electrico",
    icon: "Zap",
    items: [
      {
        key: "estado_salud_bateria_12v",
        label: "Estado de salud batería 12v",
        type: "bien_reparacion_na",
        showObservation: true,
      },
      {
        key: "carga_bateria_12v",
        label: "Carga de batería 12v",
        type: "bien_reparacion_na",
        showPhotos: true,
      },
      { key: "sistema_arranque", label: "Sistema de arranque", type: "bien_reparacion_na" },
      {
        key: "sistema_carga",
        label: "Sistema de carga",
        type: "bien_reparacion_na",
        showPhotos: true,
      },
      {
        key: "instalacion_electrica",
        label: "Instalación eléctrica",
        type: "bien_reparacion_na",
        showObservation: true,
      },
    ],
  },
  {
    id: "frenos",
    name: "Frenos",
    table: "section_frenos",
    icon: "Disc",
    items: [
      {
        key: "nivel_liquido",
        label: "Nivel de líquido",
        type: "bien_reparacion_na",
        showPhotos: true,
      },
      { key: "estado_liquido", label: "Estado de líquido", type: "bien_reparacion_na" },
      { key: "mangueras", label: "Mangueras", type: "bien_reparacion_na" },
      {
        key: "pastillas",
        label: "Pastillas",
        type: "bien_reparacion_na",
        showPhotos: true,
      },
      {
        key: "discos",
        label: "Discos",
        type: "bien_reparacion_na",
        showPhotos: true,
        showObservation: true,
      },
      {
        key: "ajuste_freno_emergencia",
        label: "Freno de estacionamiento",
        type: "bien_reparacion_na",
      },
    ],
  },
  {
    id: "suspension",
    name: "Suspensión",
    table: "section_suspension",
    icon: "Activity",
    items: [
      {
        key: "fuga_liquido_compensadores",
        label: "Fuga de líquido de compensadores",
        type: "si_no_na",
        positiveWhenNo: true,
        showPhotos: true,
      },
      {
        key: "cubre_polvos_rotulas",
        label: "Cubre polvos de rótulas",
        type: "bien_reparacion_na",
      },
      {
        key: "estado_hules",
        label: "Estado de hules",
        type: "bien_reparacion_na",
        showPhotos: true,
      },
      {
        key: "ruidos_holguras_anormales",
        label: "Ruidos u holguras anormales",
        type: "si_no_na",
        showObservation: true,
      },
    ],
  },
  {
    id: "direccion",
    name: "Dirección",
    table: "section_direccion",
    icon: "Navigation",
    items: [
      {
        key: "fugas_liquido",
        label: "Fugas de líquido",
        type: "si_no_na",
        positiveWhenNo: true,
        showPhotos: true,
      },
      {
        key: "estado_cubrepolvos",
        label: "Estado de cubrepolvos",
        type: "bien_reparacion_na",
      },
      {
        key: "ruidos_holguras_anormales",
        label: "Ruidos u holguras anormales",
        type: "si_no_na",
        showObservation: true,
      },
    ],
  },
  {
    id: "escape",
    name: "Sistema de escape",
    table: "section_escape",
    icon: "Wind",
    items: [
      {
        key: "estado_tubo_escape",
        label: "Estado",
        type: "bien_reparacion_na",
        showPhotos: true,
      },
      {
        key: "catalizador",
        label: "Catalizador",
        type: "si_no_na",
        findingWhenNo: true,
      },
      {
        key: "silenciador",
        label: "Silenciador",
        type: "si_no_na",
        findingWhenNo: true,
      },
    ],
  },
  {
    id: "neumaticos",
    name: "Neumáticos",
    table: "section_neumaticos",
    icon: "Circle",
    items: [
      {
        key: "estado",
        label: "Estado general",
        type: "bien_reparacion_na",
        showPhotos: true,
      },
      {
        key: "desgaste",
        label: "Desgaste",
        type: "select",
        options: ["normal", "irregular", "excesivo"],
        showObservation: true,
      },
      {
        key: "fabricacion",
        label: "Fecha de fabricación",
        type: "text",
        placeholder: "Ej: 2523 (semana 25, año 2023)",
      },
    ],
  },
  {
    id: "combustible",
    name: "Combustible",
    table: "section_combustible",
    icon: "Fuel",
    items: [
      {
        key: "tapa_deposito",
        label: "Tapa del depósito",
        type: "si_no_na",
        findingWhenNo: true,
      },
      {
        key: "fugas",
        label: "Fugas",
        type: "bien_reparacion_na",
        showPhotos: true,
      },
    ],
  },
  {
    id: "electronica",
    name: "Electrónica",
    table: "section_electronica",
    icon: "Cpu",
    items: [
      {
        key: "codigos_error",
        label: "Códigos de error",
        type: "si_no_na",
        showObservation: true,
        observationPlaceholder: "Liste los códigos encontrados...",
      },
      {
        key: "temperatura_refrigerante_normal",
        label: "Temperatura de refrigerante normal",
        type: "si_no_na",
        findingWhenNo: true,
      },
      {
        key: "temperatura_aceites_normal",
        label: "Temperatura de aceites normal",
        type: "si_no_na",
        findingWhenNo: true,
      },
      {
        key: "asistencia_conduccion",
        label: "Asistencia de conducción",
        type: "bien_reparacion_na",
      },
      { key: "modos_manejo", label: "Modos de manejo", type: "bien_reparacion_na" },
    ],
  },
  {
    id: "iluminacion",
    name: "Iluminación",
    table: "section_iluminacion",
    icon: "Lightbulb",
    items: [
      {
        key: "luces_frontales",
        label: "Luces frontales",
        type: "bien_reparacion_na",
        showPhotos: true,
      },
      {
        key: "luces_traseras",
        label: "Luces traseras",
        type: "bien_reparacion_na",
        showPhotos: true,
      },
      { key: "intermitentes", label: "Intermitentes", type: "bien_reparacion_na" },
      { key: "halogenos", label: "Halógenos", type: "bien_reparacion_na" },
      {
        key: "luces_cuadro_testigos",
        label: "Luces del cuadro de testigos",
        type: "bien_reparacion_na",
      },
      { key: "luces_dash", label: "Luces del dash", type: "bien_reparacion_na" },
    ],
  },
  {
    id: "accesorios",
    name: "Interior / accesorios",
    table: "section_accesorios",
    icon: "Armchair",
    items: [
      { key: "manillas_puertas", label: "Manillas de puertas", type: "bien_reparacion_na" },
      { key: "seguro_puertas", label: "Seguro de puertas", type: "bien_reparacion_na" },
      {
        key: "funcionamiento_vidrios",
        label: "Funcionamiento de vidrios",
        type: "bien_reparacion_na",
      },
      { key: "parlantes", label: "Parlantes", type: "bien_reparacion_na" },
      {
        key: "cinturones_seguridad",
        label: "Cinturones de seguridad",
        type: "bien_reparacion_na",
      },
      { key: "ajustes_asientos", label: "Ajustes de asientos", type: "bien_reparacion_na" },
      {
        key: "funcionamiento_espejos_retrovisor",
        label: "Espejos y retrovisor",
        type: "bien_reparacion_na",
      },
      { key: "luz_cabina", label: "Luz de cabina", type: "bien_reparacion_na" },
      { key: "viseras_tapasol", label: "Viseras tapa sol", type: "bien_reparacion_na" },
      { key: "quemacocos", label: "Quemacocos", type: "bien_reparacion_na" },
      { key: "tira_aguas_frontal", label: "Tira aguas frontal", type: "bien_reparacion_na" },
      { key: "tira_aguas_trasero", label: "Tira aguas trasero", type: "bien_reparacion_na" },
      { key: "escobillas", label: "Escobillas", type: "bien_reparacion_na" },
      { key: "claxon", label: "Claxón", type: "bien_reparacion_na" },
      {
        key: "controles_volante",
        label: "Controles del volante",
        type: "bien_reparacion_na",
      },
      {
        key: "controles_radio_pantalla",
        label: "Controles del radio/pantalla",
        type: "bien_reparacion_na",
      },
      { key: "funciones_radio", label: "Funciones del radio", type: "bien_reparacion_na" },
      { key: "puertos_carga", label: "Puertos de carga", type: "bien_reparacion_na" },
      { key: "camara_reversa", label: "Cámara de reversa", type: "bien_reparacion_na" },
      { key: "llave_control", label: "Llave de control", type: "bien_reparacion_na" },
      {
        key: "llavines_cierres_remotos",
        label: "Llavines y cierres remotos",
        type: "bien_reparacion_na",
      },
    ],
  },
  {
    id: "ac_calefaccion",
    name: "Aire acondicionado / calefacción",
    table: "section_ac_calefaccion",
    icon: "Snowflake",
    items: [
      {
        key: "funcionamiento_controles",
        label: "Funcionamiento de controles",
        type: "bien_reparacion_na",
        showPhotos: true,
      },
      {
        key: "accionamiento_sistema",
        label: "Activación del sistema",
        type: "si_no_na",
        findingWhenNo: true,
      },
      {
        key: "enfria_sin_dificultad",
        label: "Enfría sin dificultad",
        type: "si_no_na",
        findingWhenNo: true,
        showPhotos: true,
      },
      {
        key: "calefaccion_supera_ambiente",
        label: "Calefacción supera ambiente",
        type: "si_no_na",
        findingWhenNo: true,
      },
    ],
  },
  {
    id: "seguridad",
    name: "Equipo de seguridad",
    table: "section_seguridad",
    icon: "Shield",
    items: [
      {
        key: "llanta_repuesto",
        label: "Llanta de repuesto",
        type: "si_no_na",
        findingWhenNo: true,
        showPhotos: true,
      },
      {
        key: "llave_ranas",
        label: "Llave de ranas",
        type: "si_no_na",
        findingWhenNo: true,
      },
      { key: "gata", label: "Gata", type: "si_no_na", findingWhenNo: true },
      {
        key: "kit_emergencia",
        label: "Kit de emergencia",
        type: "si_no_na",
        findingWhenNo: true,
      },
      {
        key: "extintor",
        label: "Extintor",
        type: "si_no_na",
        findingWhenNo: true,
      },
      {
        key: "cubo_seguridad_ranas",
        label: "Cubo de seguridad de ranas",
        type: "si_no_na",
        findingWhenNo: true,
      },
    ],
  },
  {
    id: "carroceria",
    name: "Carrocería",
    table: "section_carroceria",
    icon: "Car",
    items: [
      {
        key: "vidrios_fabrica",
        label: "Vidrios de fábrica",
        type: "si_no_na",
        findingWhenNo: true,
        showObservation: true,
      },
      {
        key: "vidrios_reventaduras",
        label: "Vidrios con reventaduras",
        type: "si_no_na",
        showPhotos: true,
      },
      {
        key: "indicios_desmontaje_puertas_tapas",
        label: "Indicios de desmontaje",
        type: "si_no_na",
        showObservation: true,
      },
      {
        key: "presencia_masilla",
        label: "Presencia de masilla",
        type: "si_no_na",
        positiveWhenNo: true,
        showPhotos: true,
        showObservation: true,
      },
      {
        key: "lineas_congruentes",
        label: "Líneas congruentes",
        type: "si_no_na",
        findingWhenNo: true,
      },
      {
        key: "puntas_chasis_reparadas_torcidas",
        label: "Puntas de chasis reparadas/torcidas",
        type: "si_no_na",
        showPhotos: true,
      },
      {
        key: "herrumbre",
        label: "Herrumbre",
        type: "si_no_na",
        positiveWhenNo: true,
        showPhotos: true,
        showObservation: true,
      },
      {
        key: "aros_rayados_golpes",
        label: "Aros rayados o con golpes",
        type: "si_no_na",
        showPhotos: true,
      },
      {
        key: "tuercas_completas",
        label: "Tuercas completas",
        type: "si_no_na",
        findingWhenNo: true,
      },
      {
        key: "tuerca_seguridad",
        label: "Tuerca de seguridad",
        type: "si_no_na",
        findingWhenNo: true,
      },
    ],
  },
  {
    id: "conduccion",
    name: "Prueba de conducción",
    table: "section_conduccion",
    icon: "Route",
    items: [
      {
        key: "aceleracion",
        label: "Aceleración",
        type: "bien_reparacion_na",
        showObservation: true,
      },
      {
        key: "frenado",
        label: "Frenado",
        type: "bien_reparacion_na",
        showObservation: true,
      },
      {
        key: "estabilidad",
        label: "Estabilidad",
        type: "bien_reparacion_na",
        showObservation: true,
      },
      {
        key: "cambio_velocidades",
        label: "Cambio de velocidades",
        type: "bien_reparacion_na",
      },
      {
        key: "ruidos_anormales",
        label: "Ruidos anormales",
        type: "si_no_na",
        showObservation: true,
      },
      {
        key: "humeo",
        label: "Humeo",
        type: "si_no_na",
        showObservation: true,
      },
      {
        key: "codigos_error_post_prueba",
        label: "Códigos de error post-prueba",
        type: "si_no_na",
        showObservation: true,
      },
    ],
  },
  {
    id: "traccion",
    name: "Tracción",
    table: "section_traccion",
    icon: "Gauge",
    items: [
      {
        key: "tipo_traccion",
        label: "Tracción",
        type: "select",
        options: ["2wd", "4wd", "4x4"],
      },
      {
        key: "duplicacion",
        label: "Duplicación",
        type: "bien_reparacion_na",
        visibleWhen: { field: "tipo_traccion", values: ["4wd", "4x4"] },
      },
      {
        key: "ruidos_anormales",
        label: "Ruidos anormales",
        type: "si_no_na",
        visibleWhen: { field: "tipo_traccion", values: ["4wd", "4x4"] },
      },
      {
        key: "indicadores_tablero",
        label: "Indicadores del tablero",
        type: "bien_reparacion_na",
        visibleWhen: { field: "tipo_traccion", values: ["4wd", "4x4"] },
      },
      {
        key: "bloqueo_diferencial",
        label: "Bloqueo diferencial",
        type: "bien_reparacion_na",
        visibleWhen: { field: "tipo_traccion", values: ["4wd", "4x4"] },
      },
    ],
  },
  {
    id: "finalizacion",
    name: "Finalización",
    table: "section_finalizacion",
    icon: "CheckSquare",
    items: [
      {
        key: "nombre_inspector",
        label: "Nombre del inspector",
        type: "readonly",
        readonlySource: "inspector_name",
      },
      {
        key: "fecha_hora",
        label: "Fecha y hora",
        type: "readonly",
        readonlySource: "timestamp",
      },
      {
        key: "comentario_final",
        label: "Información importante (opcional)",
        type: "textarea",
        placeholder:
          "Datos relevantes para el cliente o la operación (opcional)...",
      },
    ],
  },
];

export function getSectionConfig(sectionId: string): SectionConfig | undefined {
  return SECTIONS_CONFIG.find((s) => s.id === sectionId);
}

/** Secciones visibles según datos del vehículo (p. ej. secciones con `conditionalOn`). */
export function getVisibleSections(
  transmissionType: string | null | undefined,
): SectionConfig[] {
  const tt = transmissionType ?? "";
  return SECTIONS_CONFIG.filter((section) => {
    if (!section.conditionalOn) return true;
    if (section.conditionalOn.field !== "transmissionType") return true;
    return section.conditionalOn.values.includes(tt);
  });
}

