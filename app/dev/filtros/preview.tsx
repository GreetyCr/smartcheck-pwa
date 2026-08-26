"use client";

import { useState } from "react";
import { FiltrosBar, type OpcionesFiltro } from "@/components/bi/FiltrosBar";
import type { FiltrosBi } from "@/lib/bi-filtros";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Opciones **reales de producción** (25-ago-2026), con las listas largas
 * recortadas a 12 para que el archivo sea legible — el recorte está dicho, no
 * escondido: en PROD «Localidad» tiene 146 opciones y «Marca» 37.
 *
 * Regenerar con:  npx convex run --prod bi/filtros:filterOptions '{}'
 */
const OPCIONES: OpcionesFiltro = {
  "dimensiones": [
    {
      "aviso": "Hay 5 revisiones sin este dato; al filtrar quedan fuera.",
      "cobertura": 882,
      "etiqueta": "Canal",
      "key": "channel",
      "opciones": [
        {
          "rows": 642,
          "valor": "Mercadeo"
        },
        {
          "rows": 110,
          "valor": "Recompra"
        },
        {
          "rows": 74,
          "valor": "Referido"
        },
        {
          "rows": 39,
          "valor": "TikTok"
        },
        {
          "rows": 17,
          "valor": "Buscador"
        }
      ]
    },
    {
      "aviso": null,
      "cobertura": 887,
      "etiqueta": "Provincia",
      "key": "province",
      "opciones": [
        {
          "rows": 349,
          "valor": "En agencia"
        },
        {
          "rows": 235,
          "valor": "San José"
        },
        {
          "rows": 152,
          "valor": "Heredia"
        },
        {
          "rows": 69,
          "valor": "Alajuela"
        },
        {
          "rows": 43,
          "valor": "Cartago"
        },
        {
          "rows": 39,
          "valor": "Desconocido"
        }
      ]
    },
    {
      "aviso": "Hay 24 revisiones sin este dato; al filtrar quedan fuera.",
      "cobertura": 863,
      "etiqueta": "Tipo de motor",
      "key": "engineType",
      "opciones": [
        {
          "rows": 677,
          "valor": "Gasolina"
        },
        {
          "rows": 162,
          "valor": "Diésel"
        },
        {
          "rows": 15,
          "valor": "Híbrido"
        },
        {
          "rows": 5,
          "valor": "Eléctrico"
        },
        {
          "rows": 4,
          "valor": "Otro"
        }
      ]
    },
    {
      "aviso": "Hay 538 revisiones sin este dato; al filtrar quedan fuera.",
      "cobertura": 349,
      "etiqueta": "Localidad",
      "key": "agency",
      "opciones": [
        {
          "rows": 42,
          "valor": "Danissa"
        },
        {
          "rows": 30,
          "valor": "VEINSA"
        },
        {
          "rows": 25,
          "valor": "Carsot"
        },
        {
          "rows": 13,
          "valor": "Autos Garage 46"
        },
        {
          "rows": 10,
          "valor": "Purdy"
        },
        {
          "rows": 10,
          "valor": "Red Motors"
        },
        {
          "rows": 9,
          "valor": "Autos Ceroestres"
        },
        {
          "rows": 9,
          "valor": "ZMotors"
        },
        {
          "rows": 7,
          "valor": "Auto Time"
        },
        {
          "rows": 7,
          "valor": "AutoXperience"
        },
        {
          "rows": 7,
          "valor": "Quality Motors"
        },
        {
          "rows": 6,
          "valor": "Avis"
        }
      ],
    },
    {
      "aviso": null,
      "cobertura": 887,
      "etiqueta": "Marca",
      "key": "brand",
      "opciones": [
        {
          "rows": 190,
          "valor": "Hyundai"
        },
        {
          "rows": 118,
          "valor": "Toyota"
        },
        {
          "rows": 94,
          "valor": "Nissan"
        },
        {
          "rows": 78,
          "valor": "Suzuki"
        },
        {
          "rows": 60,
          "valor": "Kia"
        },
        {
          "rows": 46,
          "valor": "Mitsubishi"
        },
        {
          "rows": 44,
          "valor": "BMW"
        },
        {
          "rows": 28,
          "valor": "Honda"
        },
        {
          "rows": 26,
          "valor": "Mazda"
        },
        {
          "rows": 23,
          "valor": "Audi"
        },
        {
          "rows": 23,
          "valor": "Otro"
        },
        {
          "rows": 22,
          "valor": "Chevrolet"
        }
      ],
    },
    {
      "aviso": null,
      "cobertura": 887,
      "etiqueta": "Moneda",
      "key": "currency",
      "opciones": [
        {
          "rows": 658,
          "valor": "CRC"
        },
        {
          "rows": 229,
          "valor": "USD"
        }
      ]
    },
    {
      "aviso": "Solo lo registra la app: hay dato en 145 de 887 revisiones. Al filtrar por acá, las demás quedan fuera.",
      "cobertura": 145,
      "etiqueta": "Tipo de vendedor",
      "key": "sellerType",
      "opciones": [
        {
          "rows": 77,
          "valor": "particular"
        },
        {
          "rows": 68,
          "valor": "concesionaria"
        }
      ]
    }
  ],
  "noDisponibles": [
    {
      "etiqueta": "Estado de pago",
      "motivo": "Hoy las 887 revisiones están cobradas: no hay ninguna en ₡0 ni en ₡1.000, así que el filtro tendría un solo valor y no separaría nada."
    }
  ],
  "totalRevisiones": 887
};

/**
 * Se pinta con dos listas de soporte distintas a la vez para poder aprobar de
 * un vistazo lo que más importa del diseño: **cómo se ve una dimensión que la
 * pantalla no puede honrar**.
 */
export function FiltrosPreview() {
  const [a, setA] = useState<FiltrosBi>({ periodo: "todo" });
  const [b, setB] = useState<FiltrosBi>({
    periodo: "6m",
    brand: "Hyundai",
    sellerType: "particular",
  });

  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — opciones reales de
        producción. No existe en producción.
      </div>
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        <p className="mb-2 text-[12px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          Pantalla que honra todo (Hallazgos)
        </p>
        <FiltrosBar
          filtros={a}
          opciones={OPCIONES}
          soporta={[
            "periodo",
            "channel",
            "province",
            "engineType",
            "agency",
            "brand",
            "sellerType",
            "currency",
          ]}
          onCambiar={setA}
          onLimpiar={() => setA({ periodo: "todo" })}
        />

        <p className="mb-2 mt-8 text-[12px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          Pantalla que solo honra el periodo (Finanzas), con filtros puestos que
          no aplican
        </p>
        <FiltrosBar
          filtros={b}
          opciones={OPCIONES}
          soporta={["periodo"]}
          onCambiar={setB}
          onLimpiar={() => setB({ periodo: "todo" })}
        />
      </div>
    </>
  );
}
