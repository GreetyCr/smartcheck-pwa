const transmission: Record<string, string> = {
  automatico_2wd: "Automático 2WD",
  automatico_4wd: "Automático 4WD",
  manual_2wd: "Manual 2WD",
  manual_4wd: "Manual 4WD",
};

/** Valores del ítem `tipo_transmision` en section_transmision. */
const transmissionKind: Record<string, string> = {
  manual: "Manual",
  automatico: "Automático",
};

const engine: Record<string, string> = {
  gasolina: "Gasolina",
  diesel: "Diésel",
  gas_lp: "Gas LP",
  electrico: "Eléctrico",
  hibrido: "Híbrido",
};

const country: Record<string, string> = {
  usa: "USA",
  nacional: "Nacional",
  panama: "Panamá",
  korea: "Korea",
  otros: "Otros",
  estados_unidos: "Estados Unidos",
  corea: "Corea",
  japon: "Japón",
  alemania: "Alemania",
  mexico: "México",
  otro: "Otro",
};

export function labelTransmission(v: string | undefined): string {
  if (!v) return "—";
  return transmission[v] ?? transmissionKind[v] ?? v;
}

/**
 * Etiqueta de transmisión para la portada del PDF.
 * Prioridad: ítem de sección `tipo_transmision` (Manual/Automático) →
 * campo legacy `inspections.transmissionType`.
 */
export function labelTransmissionForReport(args: {
  inspectionTransmissionType?: string | null;
  sectionTipoTransmision?: unknown;
}): string {
  const raw = args.sectionTipoTransmision;
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "value" in raw) {
    const v = (raw as { value?: unknown }).value;
    if (typeof v === "string" && v.trim()) {
      return transmissionKind[v] ?? labelTransmission(v);
    }
  }
  return labelTransmission(args.inspectionTransmissionType ?? undefined);
}

export function labelEngine(v: string | undefined): string {
  if (!v) return "—";
  return engine[v] ?? v;
}

export function labelCountry(v: string | undefined): string {
  if (!v) return "—";
  return country[v] ?? v;
}

export function labelSellerType(v: string | undefined): string {
  if (!v) return "—";
  if (v === "concesionaria") return "Concesionaria";
  if (v === "particular") return "Particular";
  return v;
}
