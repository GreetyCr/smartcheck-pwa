"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { COMMISSION_SERVICE_FEE_CRC } from "@/lib/commission";
import {
  digitsOnlyAmountInput,
  formatAmountDigits,
  parseDigitsToAmount,
} from "@/lib/amount-input";
import { cn } from "@/lib/utils";
import { WizardFieldWrap } from "@/lib/wizard-form-wrap";

export type InspectionBiClosingFieldsHandle = {
  /** Persiste monto pendiente y devuelve el valor numérico para validar. */
  flushTotalAmount: () => Promise<number>;
};

type Props = {
  inspectionId: Id<"inspections">;
  invalidKeys?: Set<string>;
};

export const InspectionBiClosingFields = forwardRef<
  InspectionBiClosingFieldsHandle,
  Props
>(function InspectionBiClosingFields({ inspectionId, invalidKeys }, ref) {
  const doc = useQuery(api.inspections.get, { id: inspectionId });
  const patchInspection = useMutation(api.inspections.patch);

  const [totalInput, setTotalInput] = useState("");

  useEffect(() => {
    if (doc === undefined || doc === null) return;
    setTotalInput(formatAmountDigits(doc.totalAmountCharged));
  }, [doc?.totalAmountCharged, doc]);

  const persistTotal = useCallback(
    async (raw: string) => {
      const digits = digitsOnlyAmountInput(raw);
      const amount = parseDigitsToAmount(digits) ?? 0;
      await patchInspection({
        id: inspectionId,
        patch: { totalAmountCharged: amount },
      });
      return amount;
    },
    [inspectionId, patchInspection],
  );

  useImperativeHandle(
    ref,
    () => ({
      flushTotalAmount: async () => persistTotal(totalInput),
    }),
    [persistTotal, totalInput],
  );

  if (doc === undefined || doc === null) {
    return null;
  }

  const commission = doc.biCommission ?? null;
  const condition = doc.biVehicleCondition ?? null;
  const commissionFee =
    doc.commissionFeeAmount ??
    (commission === "si" ? COMMISSION_SERVICE_FEE_CRC : undefined);

  const pill = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "bg-muted text-muted-foreground hover:bg-muted/80",
    );

  const fieldClass =
    "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

  const setCommissionAndSave = (v: "si" | "no") => {
    void patchInspection({
      id: inspectionId,
      patch: { biCommission: v },
    });
  };

  const setConditionAndSave = (n: 1 | 2 | 3) => {
    void patchInspection({
      id: inspectionId,
      patch: { biVehicleCondition: n },
    });
  };

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Datos internos (no salen en el PDF)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Comisión, estado del vehículo y montos para control de ingresos; solo se
          guardan en la base de datos.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">
          ¿Servicio por comisión?
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={pill(commission === "si")}
            onClick={() => setCommissionAndSave("si")}
          >
            Sí
          </button>
          <button
            type="button"
            className={pill(commission === "no")}
            onClick={() => setCommissionAndSave("no")}
          >
            No
          </button>
        </div>
        {commission === "si" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Costo de comisión registrado automáticamente:{" "}
            <span className="font-semibold text-foreground">
              ₡{COMMISSION_SERVICE_FEE_CRC.toLocaleString("es-CR")}
            </span>
            {commissionFee != null && commissionFee !== COMMISSION_SERVICE_FEE_CRC
              ? ` (guardado: ₡${commissionFee.toLocaleString("es-CR")})`
              : null}
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">
          Estado del vehículo
        </p>
        <p className="mb-2 text-xs text-muted-foreground">
          1 = bueno · 2 = regular · 3 = mal estado
        </p>
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={pill(condition === n)}
              onClick={() => setConditionAndSave(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <WizardFieldWrap
        fieldId="totalAmountCharged"
        invalid={invalidKeys?.has("totalAmountCharged")}
      >
        <div className="space-y-1.5">
          <label
            htmlFor="total-amount-charged"
            className="text-sm font-medium text-foreground"
          >
            Monto total cobrado <span className="text-destructive">*</span>
          </label>
          <input
            id="total-amount-charged"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Monto total cobrado"
            value={totalInput}
            onChange={(e) =>
              setTotalInput(digitsOnlyAmountInput(e.target.value))
            }
            onBlur={(e) => void persistTotal(e.target.value)}
            className={fieldClass}
          />
          <p className="text-xs text-muted-foreground">
            Solo dígitos, sin signos. Obligatorio para finalizar la inspección.
          </p>
        </div>
      </WizardFieldWrap>
    </div>
  );
});
