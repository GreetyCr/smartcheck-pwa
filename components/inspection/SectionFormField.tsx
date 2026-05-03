"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type {
  SectionItem,
  ReadonlyUserContext,
} from "@/lib/constants/sectionItems";
import { ItemBienReparacion } from "@/components/inspection/items/ItemBienReparacion";
import { ItemSiNo } from "@/components/inspection/items/ItemSiNo";
import { ItemSelect } from "@/components/inspection/items/ItemSelect";
import { ItemText } from "@/components/inspection/items/ItemText";
import { ItemTextarea } from "@/components/inspection/items/ItemTextarea";
import { ItemReadonly } from "@/components/inspection/items/ItemReadonly";
import type { PhotoEntry } from "@/components/inspection/items/ItemPhotos";
type SectionFormFieldProps = {
  index: number;
  item: SectionItem;
  value: unknown;
  photoEntries: PhotoEntry[] | undefined;
  /** Resaltar ítem con validación pendiente al intentar continuar. */
  fieldInvalid?: boolean;
  readonlyContext: ReadonlyUserContext;
  disabled?: boolean;
  onChange: (key: string, next: unknown) => void;
  onPickPhotos: (itemKey: string, files: File[]) => void | Promise<void>;
  onRemovePhoto: (itemKey: string, ref: string) => void;
};

function resolveReadonlyDisplay(
  item: SectionItem,
  value: unknown,
  ctx: ReadonlyUserContext,
): string {
  if (typeof value === "number") {
    return new Date(value).toLocaleString("es-CR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  switch (item.readonlySource) {
    case "inspector_name":
      return ctx.name?.trim() || "—";
    case "timestamp":
      return new Date().toLocaleString("es-CR", {
        dateStyle: "short",
        timeStyle: "short",
      });
    default:
      return "—";
  }
}

export function SectionFormField({
  index,
  item,
  value,
  photoEntries,
  fieldInvalid,
  readonlyContext,
  disabled,
  onChange,
  onPickPhotos,
  onRemovePhoto,
}: SectionFormFieldProps) {
  const wrap = (node: ReactNode) => (
    <div
      id={`section-field-${item.key}`}
      className={cn(
        "scroll-mt-28 transition-shadow",
        fieldInvalid &&
          "rounded-xl ring-2 ring-amber-500 ring-offset-2 ring-offset-background",
      )}
    >
      {node}
    </div>
  );

  switch (item.type) {
    case "bien_reparacion":
      return wrap(
        <ItemBienReparacion
          index={index}
          item={item}
          variant="bien_reparacion"
          value={value as never}
          onChange={(next) => onChange(item.key, next)}
          photoEntries={photoEntries}
          disabled={disabled}
          onPickPhotos={(files) => void onPickPhotos(item.key, files)}
          onRemovePhoto={(ref) => onRemovePhoto(item.key, ref)}
        />,
      );
    case "bien_reparacion_na":
      return wrap(
        <ItemBienReparacion
          index={index}
          item={item}
          variant="bien_reparacion_na"
          value={value as never}
          onChange={(next) => onChange(item.key, next)}
          photoEntries={photoEntries}
          disabled={disabled}
          onPickPhotos={(files) => void onPickPhotos(item.key, files)}
          onRemovePhoto={(ref) => onRemovePhoto(item.key, ref)}
        />,
      );
    case "si_no":
      return wrap(
        <ItemSiNo
          index={index}
          item={item}
          variant="si_no"
          value={value as never}
          onChange={(next) => onChange(item.key, next)}
          photoEntries={photoEntries}
          disabled={disabled}
          onPickPhotos={(files) => void onPickPhotos(item.key, files)}
          onRemovePhoto={(ref) => onRemovePhoto(item.key, ref)}
        />,
      );
    case "si_no_na":
      return wrap(
        <ItemSiNo
          index={index}
          item={item}
          variant="si_no_na"
          value={value as never}
          onChange={(next) => onChange(item.key, next)}
          photoEntries={photoEntries}
          disabled={disabled}
          onPickPhotos={(files) => void onPickPhotos(item.key, files)}
          onRemovePhoto={(ref) => onRemovePhoto(item.key, ref)}
        />,
      );
    case "select":
      return wrap(
        <ItemSelect
          index={index}
          item={item}
          value={value as never}
          onChange={(next) => onChange(item.key, next)}
          disabled={disabled}
          photoEntries={photoEntries}
          onPickPhotos={(files) => void onPickPhotos(item.key, files)}
          onRemovePhoto={(ref) => onRemovePhoto(item.key, ref)}
        />,
      );
    case "text":
      return wrap(
        <ItemText
          index={index}
          item={item}
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onChange(item.key, v)}
          disabled={disabled}
          photoEntries={photoEntries}
          onPickPhotos={(files) => void onPickPhotos(item.key, files)}
          onRemovePhoto={(ref) => onRemovePhoto(item.key, ref)}
        />,
      );
    case "textarea":
      return wrap(
        <ItemTextarea
          index={index}
          item={item}
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onChange(item.key, v)}
          disabled={disabled}
          photoEntries={photoEntries}
          onPickPhotos={(files) => void onPickPhotos(item.key, files)}
          onRemovePhoto={(ref) => onRemovePhoto(item.key, ref)}
        />,
      );
    case "readonly": {
      const text = resolveReadonlyDisplay(item, value, readonlyContext);
      return wrap(
        <ItemReadonly index={index} item={item} displayValue={text} />,
      );
    }
    default:
      return null;
  }
}
