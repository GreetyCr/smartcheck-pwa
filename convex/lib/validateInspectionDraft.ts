import {
  inspectionDraftPatchSchema,
  type InspectionDraftPatch,
} from "@/lib/validation/inspectionDraft";
import type { ZodIssue } from "zod";

export class InspectionDraftValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InspectionDraftValidationError";
  }
}

function formatValidationIssues(issues: ZodIssue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

/** Valida el payload de borrador antes de persistir (rechaza keys y enums obsoletos). */
export function validateInspectionDraftPatch(
  payload: unknown,
): InspectionDraftPatch {
  const result = inspectionDraftPatchSchema.safeParse(payload);
  if (!result.success) {
    throw new InspectionDraftValidationError(
      `Payload de borrador inválido: ${formatValidationIssues(result.error.issues)}`,
    );
  }
  return result.data;
}
