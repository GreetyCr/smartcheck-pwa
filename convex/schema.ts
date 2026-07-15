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
  v.literal("publicidad"),
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
});
