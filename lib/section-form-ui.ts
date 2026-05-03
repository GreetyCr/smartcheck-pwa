import type { SectionItem } from "@/lib/constants/sectionItems";

export type PhotoUiKind =
  | "none"
  | "single_solid"
  | "multiple_dashed"
  | "multiple_solid";

export type ObservationRule = "optional" | "when_reparacion" | "when_si";

export function observationRuleFor(item: SectionItem): ObservationRule {
  void item;
  return "optional";
}

const PHOTO_CAPABLE: ReadonlySet<SectionItem["type"]> = new Set([
  "bien_reparacion",
  "bien_reparacion_na",
  "si_no",
  "si_no_na",
  "select",
  "text",
  "textarea",
]);

export function derivePhotoUi(item: SectionItem): {
  allowPhotos: boolean;
  photoKind: PhotoUiKind;
  photoLabel: string;
} {
  if (item.type === "readonly") {
    return { allowPhotos: false, photoKind: "none", photoLabel: "" };
  }
  if (item.showPhotos === false) {
    return { allowPhotos: false, photoKind: "none", photoLabel: "" };
  }
  const defaultOptional =
    item.showPhotos !== true &&
    PHOTO_CAPABLE.has(item.type);
  if (defaultOptional) {
    return {
      allowPhotos: true,
      photoKind: "multiple_dashed",
      photoLabel: "Fotos (opcional)",
    };
  }
  if (!item.showPhotos) {
    return { allowPhotos: false, photoKind: "none", photoLabel: "" };
  }
  const label = item.photoLabel ?? "";
  const l = label.toLowerCase();
  if (l.includes("tomar 1") || l.includes("una foto")) {
    return {
      allowPhotos: true,
      photoKind: "single_solid",
      photoLabel: label || "Tomar 1 Foto",
    };
  }
  if (
    l.includes("subir múltiple") ||
    l.includes("múltiples") ||
    l.includes("agregar fotos")
  ) {
    return {
      allowPhotos: true,
      photoKind: "multiple_dashed",
      photoLabel: label || "Agregar fotos",
    };
  }
  if (l.includes("múltiple") || l.includes("fotos")) {
    return {
      allowPhotos: true,
      photoKind: "multiple_solid",
      photoLabel: label || "Fotos",
    };
  }
  return {
    allowPhotos: true,
    photoKind: "multiple_dashed",
    photoLabel: label || "Agregar fotos",
  };
}

export function okButtonLabelFor(item: SectionItem): "está_bien" | "bien" {
  if (item.key.includes("radiador")) return "bien";
  return "está_bien";
}
