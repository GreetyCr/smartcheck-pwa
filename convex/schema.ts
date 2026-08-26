/**
 * Esquema Convex — Smartcheck PWA
 * Basado en catalogo_secciones_items.md
 *
 * Cada tabla de sección referencia `inspections` por `inspectionId`.
 * Fotos a nivel de sección: campo opcional `photos` (ids de storage).
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/* -------------------------------------------------------------------------- */
/* Tipos de respuesta reutilizables (catálogo: TIPOS DE RESPUESTA)               */
/* -------------------------------------------------------------------------- */

/** bien_reparacion_na (incluye datos históricos sin «na» en valor) */
const itemBrNa = v.object({
  value: v.union(
    v.literal("bien"),
    v.literal("reparacion"),
    v.literal("na"),
  ),
  observation: v.optional(v.string()),
});

/** si_no_na */
const itemSnNa = v.object({
  value: v.union(v.literal("si"), v.literal("no"), v.literal("na")),
  observation: v.optional(v.string()),
});

const sectionPhotos = v.optional(v.array(v.id("_storage")));

/** Referencia a foto de ítem: Convex Storage o URL (p. ej. UploadThing) */
const itemPhotoRef = v.union(v.id("_storage"), v.string());

/** Fotos por clave de ítem en cualquier sección */
const sectionItemPhotos = v.optional(
  v.record(v.string(), v.array(itemPhotoRef)),
);

/* -------------------------------------------------------------------------- */
/* INFORMACIÓN GENERAL — inspections                                          */
/* -------------------------------------------------------------------------- */

const captureSource = v.union(
  /** @deprecated Preferir `mercadeo`. Se mantiene para no romper docs legacy hasta migrar. */
  v.literal("publicidad"),
  v.literal("mercadeo"),
  v.literal("tiktok"),
  v.literal("buscador"),
  v.literal("recompra"),
  v.literal("referido"),
);

const transmissionType = v.union(
  v.literal("automatico_2wd"),
  v.literal("automatico_4wd"),
  v.literal("manual_2wd"),
  v.literal("manual_4wd"),
);

const engineType = v.union(
  v.literal("gasolina"),
  v.literal("diesel"),
  v.literal("gas_lp"),
  v.literal("electrico"),
  v.literal("hibrido"),
);

/** País de origen (actual). Los literales legados se aceptan por datos históricos; migrar con `migrations.migrateLegacyCountryOfOrigin`. */
const countryOfOrigin = v.union(
  v.literal("usa"),
  v.literal("nacional"),
  v.literal("panama"),
  v.literal("korea"),
  v.literal("otros"),
  v.literal("estados_unidos"),
  v.literal("corea"),
  v.literal("japon"),
  v.literal("alemania"),
  v.literal("mexico"),
  v.literal("otro"),
);

const sellerType = v.union(
  v.literal("concesionaria"),
  v.literal("particular"),
);

const costaRicaProvince = v.union(
  v.literal("san_jose"),
  v.literal("alajuela"),
  v.literal("cartago"),
  v.literal("heredia"),
  v.literal("guanacaste"),
  v.literal("puntarenas"),
  v.literal("limon"),
);

const identifierType = v.union(v.literal("vin"), v.literal("placa"));

const mileageUnit = v.union(v.literal("km"), v.literal("millas"));

const userRole = v.union(v.literal("tecnico"), v.literal("admin"));

const approvalStatus = v.union(v.literal("pending"), v.literal("approved"));

export default defineSchema({
  /** Usuarios sincronizados desde Clerk (webhook) */
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: userRole,
    /** `pending`: esperando admin. `approved`: técnico puede usar la app. Ausente se normaliza con migración (legacy). */
    approvalStatus: v.optional(approvalStatus),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  inspections: defineTable({
    /** Propietario (Clerk user id) */
    clerkUserId: v.optional(v.string()),

    clientName: v.optional(v.string()),
    clientPhone: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    /** Legacy: dirección / texto de ubicación (wizard anterior). */
    location: v.optional(v.string()),
    sellerType: v.optional(sellerType),
    /** Nota libre para BI (opcional). */
    sellerNote: v.optional(v.string()),
    inspectionFee: v.optional(v.number()),
    /** Fuera del GAM: monto adicional cobrado (solo BD; no PDF). Null si `inGam === "si"`. */
    outOfGamFee: v.optional(v.number()),
    /** ¿Inspección en la GAM? (solo BD; no PDF). */
    inGam: v.optional(v.union(v.literal("si"), v.literal("no"))),
    /** Provincia de Costa Rica donde se realiza/cobra el servicio. Legacy puede estar ausente. */
    province: v.optional(v.union(costaRicaProvince, v.null())),
    /** ID Manychat (integración webhook); se asigna al cerrar/entregar informe. */
    manychatId: v.optional(v.string()),
    /** Monto total cobrado al cliente (solo BD / ingresos; no PDF). */
    totalAmountCharged: v.optional(v.number()),
    captureSource: v.optional(captureSource),

    vehicleBrand: v.optional(v.string()),
    vehicleModel: v.optional(v.string()),
    vehicleYear: v.optional(v.number()),
    transmissionType: v.optional(transmissionType),
    engineType: v.optional(engineType),
    engineSpec: v.optional(v.string()),
    countryOfOrigin: v.optional(countryOfOrigin),
    identifierType: v.optional(identifierType),
    identifier: v.optional(v.string()),
    /** Placa normalizada cuando el identificador principal es VIN pero también hay placa. */
    plateNumber: v.optional(v.string()),
    /** VIN estándar ISO (17 caracteres alfanuméricos sin I, O, Q). */
    vin: v.optional(v.string()),
    mileage: v.optional(v.number()),
    mileageUnit: v.optional(mileageUnit),
    /**
     * Hora de inicio elegida por el técnico/admin para el informe (ms epoch).
     * Opcional en legacy; si falta, el PDF puede omitirla o usar `_creationTime`.
     */
    inspectionStartAt: v.optional(v.number()),

    /** Legacy: una sola foto exterior; nuevas inspecciones usan los cuatro ángulos. */
    vehiclePhoto: v.optional(v.id("_storage")),
    vehiclePhotoFront: v.optional(v.id("_storage")),
    vehiclePhotoSideLeft: v.optional(v.id("_storage")),
    vehiclePhotoSideRight: v.optional(v.id("_storage")),
    vehiclePhotoRear: v.optional(v.id("_storage")),
    circulationCard: v.optional(v.id("_storage")),
    photoDekra: v.optional(v.id("_storage")),
    photoPlate: v.optional(v.id("_storage")),
    /** Texto opcional asociado a la foto de placa. */
    platePhotoNote: v.optional(v.string()),
    photoMarchamo: v.optional(v.id("_storage")),
    photoVinSticker: v.optional(v.id("_storage")),
    /** Segunda foto del VIN (misma etiqueta / otra vista). */
    photoVinSticker2: v.optional(v.id("_storage")),
    /** Foto del odómetro / kilometraje. */
    photoMileage: v.optional(v.id("_storage")),

    /**
     * draft: en curso
     * completed: inspección lista (todas las secciones)
     * pending_sync: listo para subir (p. ej. sin red)
     * synced: confirmado en nube
     */
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("completed"),
        v.literal("pending_sync"),
        v.literal("synced"),
        /** Informe PDF registrado como entregado al cliente (BI / seguimiento). */
        v.literal("report_delivered"),
      ),
    ),
    /** Conteo opcional de hallazgos (reparaciones / alertas) para el listado. */
    findingsCount: v.optional(v.number()),
    /** Marca de tiempo de última sincronización exitosa con backend. */
    lastSyncedAt: v.optional(v.number()),
    /** Informe PDF entregado al cliente (solo tras generación del PDF). */
    reportDeliveredAt: v.optional(v.number()),
    /** Solo base de datos / BI — no va en el cuerpo del PDF. */
    /** Solo BI: costo fijo de comisión (₡5,000) cuando `biCommission === "si"`. */
    commissionFeeAmount: v.optional(v.number()),
    biCommission: v.optional(v.union(v.literal("si"), v.literal("no"))),
    /** 1 = bueno … 3 = mal estado (solo BI). */
    biVehicleCondition: v.optional(
      v.union(v.literal(1), v.literal(2), v.literal(3)),
    ),
    /**
     * Identificador estable del cliente (UUID v4) para URL y sync idempotente.
     * Opcional en datos legacy; nuevas inspecciones local-first lo setean siempre.
     */
    clientId: v.optional(v.string()),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_client_id", ["clientId"]),

  /** PDFs generados del reporte de inspección (admin o técnico con acceso). */
  pdfs: defineTable({
    inspectionId: v.id("inspections"),
    storageId: v.id("_storage"),
    generatedAt: v.number(),
    generatedBy: v.id("users"),
    fileName: v.string(),
    fileSize: v.number(),
  })
    .index("by_inspection", ["inspectionId"])
    .index("by_generated_at", ["generatedAt"]),

  /* ---------------- Secciones (1–18) ---------------- */

  section_motor: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    nivel_aceite: v.optional(itemBrNa),
    aspecto_aceite: v.optional(itemBrNa),
    contaminacion_interna: v.optional(itemSnNa),
    fajas_accesorios: v.optional(itemBrNa),
    fuga_aceite: v.optional(itemSnNa),
    indicios_reparacion_prematura: v.optional(itemSnNa),
    estado_radiador_condensador: v.optional(itemBrNa),
    nivel_coolant: v.optional(itemBrNa),
    fugas_coolant: v.optional(itemSnNa),
    indicios_malas_manipulaciones: v.optional(itemSnNa),
    ruidos_anormales: v.optional(itemSnNa),
    presencia_humo: v.optional(itemSnNa),
    presencia_herrumbre_motor: v.optional(itemSnNa),
    /** Notas generales (ítem “Adicional”) */
    notas_adicional: v.optional(v.string()),
  }).index("by_inspection", ["inspectionId"]),

  section_transmision: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    tipo_transmision: v.optional(
      v.object({
        value: v.union(v.literal("manual"), v.literal("automatico")),
        observation: v.optional(v.string()),
      }),
    ),
    aspecto_liquido_transmision: v.optional(itemBrNa),
    fugas_aceite: v.optional(itemSnNa),
    estado_botas_eje: v.optional(itemBrNa),
    aspecto_liquido_embrague: v.optional(itemBrNa),
    fugas_liquido_embrague: v.optional(itemSnNa),
    funcionamiento_embrague: v.optional(itemBrNa),
    funcionamiento_palanca: v.optional(itemBrNa),
    ruidos_anormales: v.optional(itemSnNa),
    funcionamiento_cambio_velocidades: v.optional(itemBrNa),
  }).index("by_inspection", ["inspectionId"]),

  section_electrico: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    estado_salud_bateria_12v: v.optional(itemBrNa),
    carga_bateria_12v: v.optional(itemBrNa),
    sistema_arranque: v.optional(itemBrNa),
    sistema_carga: v.optional(itemBrNa),
    instalacion_electrica: v.optional(itemBrNa),
  }).index("by_inspection", ["inspectionId"]),

  section_frenos: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    nivel_liquido: v.optional(itemBrNa),
    estado_liquido: v.optional(itemBrNa),
    mangueras: v.optional(itemBrNa),
    pastillas: v.optional(itemBrNa),
    discos: v.optional(itemBrNa),
    ajuste_freno_emergencia: v.optional(itemBrNa),
  }).index("by_inspection", ["inspectionId"]),

  section_suspension: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    fuga_liquido_compensadores: v.optional(itemSnNa),
    cubre_polvos_rotulas: v.optional(itemBrNa),
    estado_hules: v.optional(itemBrNa),
    ruidos_holguras_anormales: v.optional(itemSnNa),
  }).index("by_inspection", ["inspectionId"]),

  section_direccion: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    fugas_liquido: v.optional(itemSnNa),
    estado_cubrepolvos: v.optional(itemBrNa),
    ruidos_holguras_anormales: v.optional(itemSnNa),
  }).index("by_inspection", ["inspectionId"]),

  section_escape: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    estado_tubo_escape: v.optional(itemBrNa),
    catalizador: v.optional(itemSnNa),
    silenciador: v.optional(itemSnNa),
  }).index("by_inspection", ["inspectionId"]),

  section_neumaticos: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    estado: v.optional(itemBrNa),
    desgaste: v.optional(
      v.object({
        value: v.union(
          v.literal("normal"),
          v.literal("irregular"),
          v.literal("excesivo"),
        ),
        observation: v.optional(v.string()),
      }),
    ),
    /** Fecha/código fabricación — sin observación en catálogo */
    fabricacion: v.optional(v.string()),
  }).index("by_inspection", ["inspectionId"]),

  section_combustible: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    tapa_deposito: v.optional(itemSnNa),
    fugas: v.optional(itemBrNa),
  }).index("by_inspection", ["inspectionId"]),

  section_electronica: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    codigos_error: v.optional(itemSnNa),
    temperatura_refrigerante_normal: v.optional(itemSnNa),
    temperatura_aceites_normal: v.optional(itemSnNa),
    asistencia_conduccion: v.optional(itemBrNa),
    modos_manejo: v.optional(itemBrNa),
  }).index("by_inspection", ["inspectionId"]),

  section_iluminacion: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    luces_frontales: v.optional(itemBrNa),
    luces_traseras: v.optional(itemBrNa),
    intermitentes: v.optional(itemBrNa),
    halogenos: v.optional(itemBrNa),
    luces_cuadro_testigos: v.optional(itemBrNa),
    luces_dash: v.optional(itemBrNa),
  }).index("by_inspection", ["inspectionId"]),

  section_accesorios: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    manillas_puertas: v.optional(itemBrNa),
    seguro_puertas: v.optional(itemBrNa),
    funcionamiento_vidrios: v.optional(itemBrNa),
    parlantes: v.optional(itemBrNa),
    cinturones_seguridad: v.optional(itemBrNa),
    ajustes_asientos: v.optional(itemBrNa),
    funcionamiento_espejos_retrovisor: v.optional(itemBrNa),
    luz_cabina: v.optional(itemBrNa),
    viseras_tapasol: v.optional(itemBrNa),
    quemacocos: v.optional(itemBrNa),
    tira_aguas_frontal: v.optional(itemBrNa),
    tira_aguas_trasero: v.optional(itemBrNa),
    escobillas: v.optional(itemBrNa),
    claxon: v.optional(itemBrNa),
    controles_volante: v.optional(itemBrNa),
    controles_radio_pantalla: v.optional(itemBrNa),
    funciones_radio: v.optional(itemBrNa),
    puertos_carga: v.optional(itemBrNa),
    camara_reversa: v.optional(itemBrNa),
    llave_control: v.optional(itemBrNa),
    llavines_cierres_remotos: v.optional(itemBrNa),
  }).index("by_inspection", ["inspectionId"]),

  section_ac_calefaccion: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    funcionamiento_controles: v.optional(itemBrNa),
    accionamiento_sistema: v.optional(itemSnNa),
    enfria_sin_dificultad: v.optional(itemSnNa),
    calefaccion_supera_ambiente: v.optional(itemSnNa),
  }).index("by_inspection", ["inspectionId"]),

  section_seguridad: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    llanta_repuesto: v.optional(itemSnNa),
    llave_ranas: v.optional(itemSnNa),
    gata: v.optional(itemSnNa),
    kit_emergencia: v.optional(itemSnNa),
    extintor: v.optional(itemSnNa),
    cubo_seguridad_ranas: v.optional(itemSnNa),
  }).index("by_inspection", ["inspectionId"]),

  section_carroceria: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    vidrios_fabrica: v.optional(itemSnNa),
    vidrios_reventaduras: v.optional(itemSnNa),
    indicios_desmontaje_puertas_tapas: v.optional(itemSnNa),
    presencia_masilla: v.optional(itemSnNa),
    lineas_congruentes: v.optional(itemSnNa),
    puntas_chasis_reparadas_torcidas: v.optional(itemSnNa),
    herrumbre: v.optional(itemSnNa),
    aros_rayados_golpes: v.optional(itemSnNa),
    tuercas_completas: v.optional(itemSnNa),
    tuerca_seguridad: v.optional(itemSnNa),
  }).index("by_inspection", ["inspectionId"]),

  section_conduccion: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    aceleracion: v.optional(itemBrNa),
    frenado: v.optional(itemBrNa),
    estabilidad: v.optional(itemBrNa),
    cambio_velocidades: v.optional(itemBrNa),
    ruidos_anormales: v.optional(itemSnNa),
    humeo: v.optional(itemSnNa),
    codigos_error_post_prueba: v.optional(itemSnNa),
  }).index("by_inspection", ["inspectionId"]),

  section_traccion: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    tipo_traccion: v.optional(
      v.object({
        value: v.union(
          v.literal("2wd"),
          v.literal("4wd"),
          v.literal("4x4"),
        ),
        observation: v.optional(v.string()),
      }),
    ),
    duplicacion: v.optional(itemBrNa),
    ruidos_anormales: v.optional(itemSnNa),
    indicadores_tablero: v.optional(itemBrNa),
    bloqueo_diferencial: v.optional(itemBrNa),
  }).index("by_inspection", ["inspectionId"]),

  section_finalizacion: defineTable({
    inspectionId: v.id("inspections"),
    photos: sectionPhotos,
    itemPhotos: sectionItemPhotos,
    nombre_inspector: v.optional(v.string()),
    fecha_hora: v.optional(v.number()),
    comentario_final: v.optional(
      v.object({
        texto: v.string(),
        observacion: v.optional(v.string()),
      }),
    ),
  }).index("by_inspection", ["inspectionId"]),

  /* -------------------------------------------------------------------------- */
  /* BI — tablas nuevas (ADITIVO). Prefijo propio; solo lectura sobre operativas. */
  /* Ver SmartCheck-BI-Proyecto/docs/MODELO-DATOS.md §1.2, §1.4, §1.6.           */
  /* -------------------------------------------------------------------------- */

  /** Ledger único: ingresos + gastos + viáticos (Sheet F1 + captura F5). §1.2 */
  finance_entries: defineTable({
    kind: v.union(v.literal("income"), v.literal("expense")),
    category: v.string(), // allow-list en la mutation (RF-11)
    isViatico: v.boolean(), // true si category ∈ {comida,gasolina,bonos,otros} (B16, RF-18)
    amountCRC: v.number(), // NORMALIZADO a ₡ (única cifra para métricas)
    originalAmount: v.optional(v.number()),
    originalCurrency: v.union(v.literal("CRC"), v.literal("USD")),
    fxRate: v.optional(v.number()), // ₡/US$ congelado (solo sep2025–feb2026)
    date: v.number(),
    yearMonth: v.string(), // "2025-09"
    // "inspection" = generada por el sistema al entregar el reporte (F5-auto):
    // NO editable desde el formulario; se re-deriva de la inspección enlazada.
    // "planilla" = una de las seis líneas derivadas del mes (B28): tampoco se
    // edita a mano, se re-deriva de `payroll_months`.
    source: v.union(
      v.literal("sheet"),
      v.literal("manual"),
      v.literal("inspection"),
      v.literal("planilla"),
    ),
    // Idempotencia. Dos vocabularios:
    //   F1 (Sheet):     "sheet:<pestaña>:<etiqueta>:<n>"
    //   F5-auto (app):  "inspection:<inspectionId>:income" | ":comision"
    externalKey: v.optional(v.string()),
    note: v.optional(v.string()),
    tecnico: v.optional(v.string()), // viático (RF-19)
    localidad: v.optional(v.string()),
    linkedInspectionId: v.optional(v.id("inspections")),
    isDeleted: v.boolean(), // soft-delete (nunca hard-delete)
    createdBy: v.optional(v.string()), // clerkId (Esteban) en captura manual (RF-14)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_external_key", ["externalKey"])
    .index("by_year_month", ["yearMonth"])
    .index("by_kind", ["kind"]),

  /** Log de calidad (nunca filtrar en silencio — AGENTS §3). §1.4 */
  bi_quality_issues: defineTable({
    issueType: v.string(), // orphan_pdf | zero_revenue | inspection_dup | lead_dup | ambiguous_match | anomalous_phone | incomplete_sections | fx_missing | reconciliation_gap
    severity: v.union(
      v.literal("info"),
      v.literal("warn"),
      v.literal("error"),
    ),
    entity: v.string(), // tabla/entidad afectada
    entityRef: v.string(), // id/clave
    detail: v.optional(v.string()),
    runId: v.string(), // corrida que lo detectó
    detectedAt: v.number(),
    resolved: v.boolean(),
  })
    .index("by_type", ["issueType"])
    .index("by_run", ["runId"]),

  /**
   * Inspecciones históricas del CRM (Google Sheet "CRM Smartcheck") — import
   * único, frozen (ya no se actualiza). MODELO-DATOS §8 (WP-L). ADITIVO, solo BI.
   * `by_source_row` (extra vs §8) da la llave idempotente del import.
   */
  inspections_legacy: defineTable({
    sourceRowId: v.string(), // fila del CRM (idempotencia del import)
    inspectionDate: v.number(), // epoch ms (CR); 0 = sentinela sin fecha (ver issue missing_date)
    clientName: v.optional(v.string()), // PII
    phone8: v.optional(v.string()), // teléfono normalizado (27% presente)
    plate: v.optional(v.string()), // placa (65%) — mejor llave de unión
    vehicleBrand: v.optional(v.string()),
    vehicleModel: v.optional(v.string()),
    engineType: v.optional(v.string()), // Tipo de Motor (filtro B3)
    channel: v.optional(v.string()), // Fuente (canal) — poblado
    province: v.optional(v.string()),
    amountCRC: v.optional(v.number()), // USD→₡ (FX WP-2) o ₡ directo; ausente si ambiguo/sin convertir
    originalAmount: v.optional(v.number()),
    originalCurrency: v.union(v.literal("CRC"), v.literal("USD")),
    fxRate: v.optional(v.number()),
    reportLink: v.optional(v.string()),
    note: v.optional(v.string()), // outliers/flags
  })
    .index("by_source_row", ["sourceRowId"])
    .index("by_plate", ["plate"])
    .index("by_phone8", ["phone8"])
    .index("by_date", ["inspectionDate"]),

  /**
   * Emparejamiento materializado lead ↔ inspección (embudo de conversión). §1.3 + §8.
   *
   * ADITIVO, solo BI. Se **recomputa completo** en cada rebuild (barato a esta
   * escala). "Lead convertido" = existe un `bi_matches` con `validIncome=true`
   * (la inspección emparejada tiene ingreso válido). La verdad de conversión es
   * ESTA tabla, no `leads_contacts.leadStage` (que es caché).
   *
   * EXTENSIONES sobre el §1.3 original (que precede a la tabla legacy del §8):
   *  - `legacyInspectionId` + `matchTarget`: la vista unificada `inspections_all`
   *    (§8) abarca DOS tablas (`inspections` era-app ≥ corte, `inspections_legacy`
   *    < corte). El §1.3 solo referenciaba `inspections`; se añade la referencia a
   *    legacy para poder materializar matches de ambas fuentes (espeja los cachés
   *    `linkedInspectionId`/`linkedLegacyId` de `leads_contacts`).
   *  - `name_vehicle_window` en `matchMethod` y `confidenceBand`: la cascada de
   *    confianza pedida (alta/media/baja) incluye el fallback débil nombre+vehículo.
   *  - `validIncome`/`amountCRC`/`inspectionDate` desnormalizados: sirven el
   *    embudo y la muestra "quiénes convierten" sin re-leer las inspecciones.
   */
  bi_matches: defineTable({
    // Lado lead
    phone8: v.optional(v.string()), // llave de join (ausente si match por nombre sin teléfono)
    leadDedupKey: v.optional(v.string()), // → leads_contacts.dedupKey (FK lógica, §4)
    leadId: v.optional(v.id("leads_contacts")), // referencia directa (conveniencia)
    // Lado inspección (una de las dos según matchTarget; vista unificada §8)
    matchTarget: v.union(
      v.literal("era_app"), // inspección Convex (≥ corte)
      v.literal("legacy"), // inspección CRM histórica (< corte)
      v.literal("none"), // reservado (fila sin inspección)
    ),
    inspectionId: v.optional(v.id("inspections")), // era-app (§1.3)
    legacyInspectionId: v.optional(v.id("inspections_legacy")), // legacy (§8, extensión)
    // Método / confianza (cascada §2)
    matchMethod: v.union(
      v.literal("manychat"), // futuro (cuando el dev pueble manychatId)
      v.literal("phone_exact"), // phone8 exacto, sin ambigüedad → alta
      v.literal("phone_vehicle_window"), // phone8 + desambiguación vehículo/ventana → media
      v.literal("name_vehicle_window"), // fallback débil nombre+vehículo+ventana → baja
      v.literal("unmatched"), // reservado
    ),
    matchKey: v.string(), // valor natural usado ("phone:<8>" o "name:<n>|brand:<b>")
    confidence: v.number(), // 0..1
    confidenceBand: v.union(
      v.literal("alta"),
      v.literal("media"),
      v.literal("baja"),
    ),
    ambiguous: v.boolean(), // varios leads/inspecciones para el mismo phone8
    validIncome: v.boolean(), // la inspección emparejada tiene ingreso válido (define conversión)
    // Desnormalizado de la inspección (embudo / muestra "quiénes convierten")
    inspectionDate: v.optional(v.number()),
    amountCRC: v.optional(v.number()),
    computedAt: v.number(),
  })
    .index("by_phone8", ["phone8"])
    .index("by_lead", ["leadDedupKey"])
    .index("by_inspection", ["inspectionId"])
    .index("by_legacy_inspection", ["legacyInspectionId"]),

  /** Frescura/estado por proceso (RF-09). §1.6 */
  bi_meta: defineTable({
    key: v.string(), // "leads_sync" | "finance_migration" | "matches_rebuild"
    lastRunAt: v.number(), // "última actualización" (RF-09)
    lastStatus: v.union(v.literal("ok"), v.literal("error")),
    rowsProcessed: v.optional(v.number()),
    message: v.optional(v.string()),
  }).index("by_key", ["key"]),

  /**
   * Contraste mensual **hoja ↔ Convex** (A56).
   *
   * La hoja de cálculo sigue viva y la migración fue una foto: cualquier mes
   * puede cambiar hacia atrás sin que nos enteremos. Una fila por mes, que se
   * reescribe en cada corrida.
   *
   * **Se guardan DOS comparaciones, no una**, y esa es toda la idea:
   *
   *  1. `difIngreso`/`difGasto` = Convex − **las filas** de la hoja. Contesta
   *     «¿seguimos teniendo lo mismo que la hoja?», que es lo que pedía A56.
   *  2. `difTotalIngreso`/`difTotalGasto` = las filas de la hoja − **su propia
   *     celda TOTAL**. Contesta «¿la hoja cuadra consigo misma?».
   *
   * La segunda apareció al construir esto y no estaba prevista: en la primera
   * corrida encontró que **julio-2025 se deja la última semana fuera del total**
   * y que **diciembre-2025 suma dos veces el subtotal de fijos**. Comparar
   * contra la celda TOTAL —lo natural— habría dado por buena la hoja y por mala
   * a Convex, que es al revés.
   */
  bi_sheet_contrast: defineTable({
    yearMonth: v.string(),
    /** Moneda en que está escrito ese mes en la hoja (`CRC` | `USD` | `mixta`). */
    moneda: v.string(),
    /** Suma de las FILAS de la hoja, sin sus subtotales. */
    hojaIngreso: v.number(),
    hojaGasto: v.number(),
    hojaFilas: v.number(),
    /** Lo que dice la celda TOTAL de la hoja. `null` si no se encontró. */
    totalIngreso: v.union(v.number(), v.null()),
    totalGasto: v.union(v.number(), v.null()),
    /** Suma de las filas de Convex con `source:"sheet"`, en moneda original. */
    convexIngreso: v.number(),
    convexGasto: v.number(),
    convexFilas: v.number(),
    difIngreso: v.number(),
    difGasto: v.number(),
    difTotalIngreso: v.union(v.number(), v.null()),
    difTotalGasto: v.union(v.number(), v.null()),
    /** Alguna diferencia pasa el umbral y NO está declarada como esperada. */
    significativo: v.boolean(),
    /** Motivo, si la diferencia es una que ya conocemos y aceptamos. */
    explicacion: v.union(v.string(), v.null()),
    runAt: v.number(),
  }).index("by_year_month", ["yearMonth"]),

  /* ------------------------------------------------------------------------ */
  /* PLANILLA DEL MES — los tres datos que Esteban escribe (B28)               */
  /* ------------------------------------------------------------------------ */
  /**
   * Lo que Esteban captura una vez al mes. Las **seis líneas derivadas** viven
   * en `finance_entries` con `source: "planilla"`; acá quedan sus **insumos**.
   *
   * Se guardan aparte a propósito: permite mostrarle qué escribió el mes pasado,
   * corregir un dato y recalcular las seis, y deja auditable **con qué tasas** se
   * calculó cada mes — que importa porque las tasas cambian (marzo salió con
   * otras y resultó ser un error suyo, B30).
   */
  payroll_months: defineTable({
    yearMonth: v.string(), // "2026-07"
    salarioCRC: v.number(),
    comisionesCRC: v.number(),
    /** La base que él decide reportar. La elige él; el sistema no la deduce. */
    baseImponibleCRC: v.number(),
    /** Tasas usadas en ESTE mes — congeladas para poder auditar hacia atrás. */
    tasas: v.object({
      aportePatronalPct: v.number(),
      provisionPct: v.number(),
      vacacionesPct: v.number(),
      impuestosPct: v.number(),
    }),
    createdBy: v.string(), // clerkId
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_year_month", ["yearMonth"]),

  /* ------------------------------------------------------------------------ */
  /* INTERRUPTORES DEL BOT — kill-switch (A37)                                 */
  /* ------------------------------------------------------------------------ */
  /**
   * Estado del bot. Tabla PROPIA, no `bi_meta` (A65): `bi_meta` responde
   * "cuándo corrió X y cómo le fue" — no tiene dónde guardar un valor. Meter
   * acá un booleano lo habría deformado.
   *
   * Guarda **quién** y **cómo** lo cambió, que en un kill-switch es justo lo
   * que uno quiere tener a mano cuando algo salió mal. Es el estado ACTUAL,
   * no el historial: si durante el cutover hace falta la traza completa, se
   * agrega una tabla de eventos aparte.
   *
   * Hoy la única llave es `chatbot_global` (espeja la tabla "ON/OFF Chatbot"
   * de Airtable). El on/off **por-lead** vive en `leads_contacts.chatbotActive`
   * y NO es confiable hasta resolver A66 — el sync semanal lo pisa.
   */
  bot_settings: defineTable({
    key: v.string(), // "chatbot_global" (única por ahora; `v.string()` deja crecer)
    enabled: v.boolean(),
    updatedAt: v.number(),
    updatedBy: v.string(), // clerkId del admin, o "api" cuando lo cambia n8n
    updatedVia: v.union(
      v.literal("dashboard"),
      v.literal("api"),
      v.literal("system"),
    ),
    note: v.optional(v.string()), // por qué se apagó — se agradece a las 2 a.m.
  }).index("by_key", ["key"]),

  /**
   * Leads / contactos — FUENTE DE VERDAD (operativa + BI), reemplaza a Airtable
   * "Vehículos". MODELO-LEADS-CONTACTS-v2. ADITIVO. Carga histórica 1:1 por
   * `airtableId` (sin fusionar; duplicados → `bi_quality_issues` para curación,
   * A26). Dedup en cascada manychatId→phone8 en el upsert continuo.
   */
  leads_contacts: defineTable({
    // Identidad / dedup
    dedupKey: v.string(), // COALESCE(manychatId, phone8, "synthetic:"+_id)
    manychatId: v.optional(v.string()), // llave fuerte a futuro (bots); vacía en histórico
    phone8: v.optional(v.string()), // últimos 8 díg CR — join con inspections
    phoneValid: v.boolean(), // false si placeholder/PSID/anómalo
    rawPhone: v.optional(v.string()), // WhatsApp original (auditar normalización)
    // Contacto / persona (PII)
    name: v.optional(v.string()),
    locality: v.optional(v.string()),
    needsInvoice: v.optional(v.boolean()),
    // Vehículo (desambiguar match tel↔inspección)
    vehicleBrand: v.optional(v.string()),
    vehicleModel: v.optional(v.string()),
    vehicleYear: v.optional(v.number()),
    transmissionType: v.optional(v.string()),
    engineType: v.optional(v.string()),
    tractionType: v.optional(v.string()),
    vehicleConditionNote: v.optional(v.string()),
    // Ciclo de vida operativo
    leadStage: v.union(
      v.literal("nuevo"),
      v.literal("contactado"),
      v.literal("en_seguimiento"),
      v.literal("agendado"),
      v.literal("convertido"), // caché derivada de bi_matches, no verdad de conversión
      v.literal("perdido"),
      v.literal("expirado"),
    ),
    paymentStatus: v.optional(
      v.union(
        v.literal("esperando"),
        v.literal("recibido"),
        v.literal("expirado"),
        v.literal("en_handoff"),
      ),
    ),
    channel: v.optional(
      v.union(
        v.literal("publicidad"),
        v.literal("mercadeo"),
        v.literal("tiktok"),
        v.literal("buscador"),
        v.literal("recompra"),
        v.literal("referido"),
        v.literal("otro"),
      ),
    ),
    chatbotActive: v.optional(v.boolean()), // "Chatbot Activado"
    reminders: v.optional(v.string()),
    // Cadencia de seguimiento (banderas del bot)
    followup2hDone: v.optional(v.boolean()),
    followup23hDone: v.optional(v.boolean()),
    followup48hDone: v.optional(v.boolean()),
    auditCompleted: v.optional(v.boolean()),
    sentToSecondTech: v.optional(v.boolean()),
    // Timestamps de negocio (epoch ms, TZ CR)
    sourceCreatedAt: v.optional(v.number()), // "Creada" de Airtable
    lastContactAt: v.optional(v.number()),
    appointmentAt: v.optional(v.number()),
    paymentPendingAt: v.optional(v.number()),
    // Enlace con el modelo (cachés del match; inspections NO se toca)
    linkedInspectionId: v.optional(v.id("inspections")),
    linkedLegacyId: v.optional(v.id("inspections_legacy")),
    // Provenance / dedup / auditoría
    source: v.union(
      v.literal("airtable_migration"),
      v.literal("bot"),
      v.literal("manual"),
    ),
    airtableId: v.optional(v.string()), // "rec…" — trazabilidad de la migración
    mergedAirtableIds: v.optional(v.array(v.string())), // reservado (no se fusiona en la carga inicial, A26)
    isDeleted: v.boolean(), // soft-delete (nunca hard-delete)
    createdAt: v.number(), // alta EN CONVEX
    updatedAt: v.number(),
  })
    .index("by_dedup_key", ["dedupKey"])
    .index("by_manychat", ["manychatId"])
    .index("by_phone8", ["phone8"])
    .index("by_airtable_id", ["airtableId"]) // idempotencia de la carga 1:1 (A26)
    .index("by_stage", ["leadStage"])
    // Seguimientos vencidos (`GET /leads/due-followups`, A37): el corte es un
    // rango sobre `lastContactAt`. Sin este índice el endpoint escanea las
    // 8.706 filas en cada llamada del cron de n8n.
    .index("by_last_contact", ["lastContactAt"])
    .index("by_source_created", ["sourceCreatedAt"])
    .index("by_created", ["createdAt"]),
});
