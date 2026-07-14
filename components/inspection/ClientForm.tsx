"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { useInspectionWizard } from "@/components/inspection/InspectionWizard";
import {
  isValidPhoneCr8Digits,
  normalizePhoneDigitsCr,
} from "@/lib/phone-cr";
import type {
  CaptureSource,
  CostaRicaProvinceKey,
  SellerTypeKey,
} from "@/types/inspection-draft";
import { formControlValue } from "@/lib/browser-confirm";
import { isValidOptionalEmail } from "@/lib/vehicle-form";
import { COSTA_RICA_PROVINCES } from "@/lib/costa-rica-provinces";
import { cn } from "@/lib/utils";
import {
  digitsOnlyAmountInput,
  parseDigitsToAmount,
} from "@/lib/amount-input";

const CAPTURE_LABELS: Record<CaptureSource, string> = {
  publicidad: "Publicidad",
  tiktok: "TikTok",
  buscador: "Buscador",
  recompra: "Recompra",
  referido: "Referido",
};

const CAPTURE_ORDER: CaptureSource[] = [
  "publicidad",
  "tiktok",
  "buscador",
  "recompra",
  "referido",
];

const fieldClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30";

export function ClientForm({ className }: { className?: string }) {
  const router = useRouter();
  const { draft, setDraft } = useInspectionWizard();

  const phoneDigits = normalizePhoneDigitsCr(draft.clientPhone);
  const showOutOfGamFee = draft.inGam === "no";
  const outOfGamAmount = parseDigitsToAmount(draft.outOfGamFeeInput);

  const isValid = useMemo(() => {
    const nameOk = draft.clientName.trim().length >= 3;
    const phoneOk = isValidPhoneCr8Digits(phoneDigits);
    const sellerOk = draft.sellerType !== "";
    const sourceOk = draft.captureSource !== "";
    const emailOk = isValidOptionalEmail(draft.clientEmail);
    const gamOk = draft.inGam === "si" || draft.inGam === "no";
    // Concesionaria: provincia opcional; particular / sin tipo: requerida.
    const provinceOk =
      draft.sellerType === "concesionaria" || draft.province !== "";
    const feeOk =
      draft.inGam === "si" ||
      (draft.inGam === "no" && outOfGamAmount !== undefined && outOfGamAmount > 0);
    return (
      nameOk &&
      phoneOk &&
      sellerOk &&
      sourceOk &&
      emailOk &&
      gamOk &&
      provinceOk &&
      feeOk
    );
  }, [
    draft.clientName,
    draft.captureSource,
    draft.clientEmail,
    draft.sellerType,
    draft.inGam,
    draft.province,
    outOfGamAmount,
    phoneDigits,
  ]);

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setDraft({
      clientPhone: phoneDigits,
    });

    router.push("/inspecciones/nueva/vehiculo");
  }

  return (
    <form
      onSubmit={handleNext}
      className={cn("mx-auto max-w-lg space-y-5 px-4 py-4", className)}
    >
      <h2 className="text-xl font-bold text-primary">Datos del Cliente</h2>

      <div className="space-y-1.5">
        <label htmlFor="client-name" className="text-sm font-medium text-foreground">
          Nombre Completo
        </label>
        <input
          id="client-name"
          name="clientName"
          type="text"
          autoComplete="name"
          placeholder="Ej. Juan Pérez"
          value={draft.clientName}
          onChange={(e) =>
            setDraft({ clientName: formControlValue(e) })
          }
          className={fieldClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="client-phone" className="text-sm font-medium text-foreground">
          Teléfono
        </label>
        <input
          id="client-phone"
          name="clientPhone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="+506 0000-0000"
          value={draft.clientPhone}
          onChange={(e) =>
            setDraft({ clientPhone: formControlValue(e) })
          }
          className={fieldClass}
        />
        {draft.clientPhone.length > 0 && !isValidPhoneCr8Digits(phoneDigits) ? (
          <p className="text-xs text-destructive">Ingresa 8 dígitos (Costa Rica).</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="client-email" className="text-sm font-medium text-foreground">
          Correo electrónico <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="client-email"
          name="clientEmail"
          type="email"
          autoComplete="email"
          placeholder="correo@ejemplo.com"
          value={draft.clientEmail}
          onChange={(e) =>
            setDraft({ clientEmail: formControlValue(e) })
          }
          className={fieldClass}
        />
        {draft.clientEmail.trim().length > 0 &&
        !isValidOptionalEmail(draft.clientEmail) ? (
          <p className="text-xs text-destructive">Revisa el formato del correo.</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <span id="seller-type-label" className="text-sm font-medium text-foreground">
          Origen de compra
        </span>
        <p className="text-xs text-muted-foreground">
          ¿Es concesionaria o particular?
        </p>
        <ToggleButtonGroup
          labelId="seller-type-label"
          variant="outline"
          value={draft.sellerType}
          onChange={(sellerType) =>
            setDraft({ sellerType: sellerType as SellerTypeKey | "" })
          }
          options={[
            { value: "concesionaria" as const, label: "Concesionaria" },
            { value: "particular" as const, label: "Particular" },
          ]}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="seller-note" className="text-sm font-medium text-foreground">
          Nota <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          id="seller-note"
          name="sellerNote"
          rows={3}
          placeholder="Detalle adicional para contexto comercial…"
          value={draft.sellerNote}
          onChange={(e) =>
            setDraft({ sellerNote: formControlValue(e) })
          }
          className={cn(fieldClass, "min-h-[88px] resize-y")}
        />
      </div>

      <div className="space-y-1.5">
        <span id="revisiones-label" className="text-sm font-medium text-foreground">
          Cantidad de Revisiones
        </span>
        <ToggleButtonGroup
          labelId="revisiones-label"
          value={draft.inspectionCount}
          onChange={(inspectionCount) => setDraft({ inspectionCount })}
          options={[
            { value: 1 as const, label: "1" },
            { value: 2 as const, label: "2" },
            { value: 3 as const, label: "3+" },
          ]}
        />
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card px-4 py-3">
        <span id="in-gam-label" className="text-sm font-medium text-foreground">
          ¿Se encuentra en el GAM?
        </span>
        <p className="text-xs text-muted-foreground">Gran Área Metropolitana</p>
        <ToggleButtonGroup
          labelId="in-gam-label"
          variant="outline"
          value={draft.inGam}
          onChange={(inGam) =>
            setDraft({
              inGam: inGam as "si" | "no" | "",
              ...(inGam === "si" ? { outOfGamFeeInput: "" } : {}),
            })
          }
          options={[
            { value: "si" as const, label: "Sí" },
            { value: "no" as const, label: "No" },
          ]}
        />
        <div className="space-y-1.5 pt-1">
          <label
            htmlFor="province"
            className="text-sm font-medium text-foreground"
          >
            Provincia
            {draft.sellerType === "concesionaria" ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                (opcional)
              </span>
            ) : (
              <span className="text-destructive"> *</span>
            )}
          </label>
          <div className="relative">
            <select
              id="province"
              name="province"
              value={draft.province}
              onChange={(e) =>
                setDraft({
                  province: formControlValue(e) as CostaRicaProvinceKey | "",
                })
              }
              className={cn(
                fieldClass,
                "appearance-none bg-card pr-10",
                draft.province === "" ? "text-muted-foreground" : "",
              )}
            >
              <option value="" disabled>
                Seleccione provincia
              </option>
              {COSTA_RICA_PROVINCES.map((province) => (
                <option key={province.value} value={province.value}>
                  {province.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>
        </div>
        {showOutOfGamFee ? (
          <div className="space-y-1.5 pt-1">
            <label
              htmlFor="out-of-gam-fee"
              className="text-sm font-medium text-foreground"
            >
              Adicional a cobrar
            </label>
            <input
              id="out-of-gam-fee"
              name="outOfGamFee"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Adicional a cobrar"
              value={draft.outOfGamFeeInput}
              onChange={(e) =>
                setDraft({
                  outOfGamFeeInput: digitsOnlyAmountInput(formControlValue(e)),
                })
              }
              className={fieldClass}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="capture-source" className="text-sm font-medium text-foreground">
          ¿Cómo nos conoció?
        </label>
        <div className="relative">
          <select
            id="capture-source"
            name="captureSource"
            value={draft.captureSource}
            onChange={(e) =>
              setDraft({
                captureSource: formControlValue(e) as CaptureSource | "",
              })
            }
            className={cn(
              fieldClass,
              "appearance-none bg-card pr-10",
              draft.captureSource === "" ? "text-muted-foreground" : "",
            )}
          >
            <option value="" disabled>
              Seleccione una opción
            </option>
            {CAPTURE_ORDER.map((key) => (
              <option key={key} value={key}>
                {CAPTURE_LABELS[key]}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={!isValid}
          size="lg"
          className="h-12 w-full rounded-2xl text-base font-semibold"
        >
          Siguiente
          <ArrowRight className="size-5" data-icon="inline-end" />
        </Button>
      </div>
    </form>
  );
}
