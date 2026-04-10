"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

export function NewInspectionCTA() {
  return (
    <Link
      href="/inspecciones/nueva"
      className="flex items-center justify-between gap-4 rounded-2xl bg-[#FF8C00] px-5 py-5 text-white shadow-md transition-opacity active:opacity-95"
    >
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">Nueva Inspección</p>
        <p className="mt-1 text-sm text-white/90">Comenzar peritaje técnico</p>
      </div>
      <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/20">
        <Plus className="size-8 stroke-[2.5]" aria-hidden />
      </div>
    </Link>
  );
}
