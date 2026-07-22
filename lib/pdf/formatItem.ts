import type { SectionItem } from "@/lib/constants/sectionItems";

export type FormattedLine = {
  label: string;
  value: string;
  observation?: string;
};

const BR_NA: Record<string, string> = {
  bien: "Está bien",
  reparacion: "Atención",
  na: "N/A",
};

const SI_NO: Record<string, string> = {
  si: "Sí",
  no: "No",
};

const SI_NO_NA: Record<string, string> = {
  ...SI_NO,
  na: "N/A",
};

const SELECT_LABELS: Record<string, string> = {
  normal: "Normal",
  irregular: "Irregular",
  excesivo: "Excesivo",
  "2wd": "2WD",
  "4wd": "4WD",
  "4x4": "4x4",
  manual: "Manual",
  automatico: "Automático",
};

function str(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "string") return v.trim() || "—";
  if (typeof v === "number") return String(v);
  return "—";
}

export function formatItemForPdf(
  item: SectionItem,
  raw: unknown,
): FormattedLine {
  if (raw === undefined || raw === null) {
    return { label: item.label, value: "—" };
  }

  switch (item.type) {
    case "bien_reparacion": {
      const o = raw as { value?: string; observation?: string };
      const v = o.value ?? "";
      return {
        label: item.label,
        value: BR_NA[v] ?? v,
        observation: o.observation?.trim() || undefined,
      };
    }
    case "bien_reparacion_na": {
      const o = raw as { value?: string; observation?: string };
      const v = o.value ?? "";
      return {
        label: item.label,
        value: BR_NA[v] ?? v,
        observation: o.observation?.trim() || undefined,
      };
    }
    case "si_no": {
      const o = raw as { value?: string; observation?: string };
      const v = o.value ?? "";
      return {
        label: item.label,
        value: SI_NO[v] ?? v,
        observation: o.observation?.trim() || undefined,
      };
    }
    case "si_no_na": {
      const o = raw as { value?: string; observation?: string };
      const v = o.value ?? "";
      return {
        label: item.label,
        value: SI_NO_NA[v] ?? v,
        observation: o.observation?.trim() || undefined,
      };
    }
    case "select": {
      const o = raw as { value?: string; observation?: string };
      const v = o.value ?? "";
      return {
        label: item.label,
        value: SELECT_LABELS[v] ?? str(o.value),
        observation: o.observation?.trim() || undefined,
      };
    }
    case "text":
      return { label: item.label, value: str(raw) };
    case "textarea": {
      if (raw && typeof raw === "object" && "texto" in (raw as object)) {
        const t = String((raw as { texto?: string }).texto ?? "").trim();
        return { label: item.label, value: t || "—" };
      }
      return { label: item.label, value: str(raw) };
    }
    case "readonly": {
      const v =
        typeof raw === "number"
          ? new Date(raw).toLocaleString("es-CR", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : str(raw);
      return { label: item.label, value: v };
    }
    default:
      return { label: item.label, value: str(raw) };
  }
}
