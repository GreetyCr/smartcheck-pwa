import { notFound } from "next/navigation";
import { ChannelDashboard, type ChannelRevenue } from "@/components/bi/ChannelDashboard";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Revisión visual de **Ingresos por canal**, sin sesión y sin tocar datos.
 * 404 en producción real (mismo criterio que `/dev/finanzas`).
 *
 * Los datos son los **reales de producción al 24-ago-2026**, congelados. No son
 * de juguete a propósito: con cifras inventadas no se ve que Mercadeo aplasta al
 * resto, que es justo el problema de diseño que esta pantalla tiene que
 * resolver — ni que TikTok lleva tres meses en cero.
 */
const MUESTRA: ChannelRevenue = {
    "totalRows": 882,
    "totalRowsConMonto": 882,
    "totalIngresosCRC": 52469284,
    "ticketPromedioCRC": 59489,
    "canales": [
      {
        "canal": "Mercadeo",
        "rows": 640,
        "rowsConMonto": 640,
        "ingresosCRC": 38882209,
        "pctIngresos": 74.1,
        "pctRows": 72.6,
        "ticketPromedioCRC": 60753,
        "ultimaRevisionISO": "2026-08-22",
        "mesesSinRevision": 0
      },
      {
        "canal": "Recompra",
        "rows": 108,
        "rowsConMonto": 108,
        "ingresosCRC": 6167140,
        "pctIngresos": 11.8,
        "pctRows": 12.2,
        "ticketPromedioCRC": 57103,
        "ultimaRevisionISO": "2026-08-21",
        "mesesSinRevision": 0
      },
      {
        "canal": "Referido",
        "rows": 73,
        "rowsConMonto": 73,
        "ingresosCRC": 4168971,
        "pctIngresos": 7.9,
        "pctRows": 8.3,
        "ticketPromedioCRC": 57109,
        "ultimaRevisionISO": "2026-08-22",
        "mesesSinRevision": 0
      },
      {
        "canal": "TikTok",
        "rows": 39,
        "rowsConMonto": 39,
        "ingresosCRC": 1990419,
        "pctIngresos": 3.8,
        "pctRows": 4.4,
        "ticketPromedioCRC": 51036,
        "ultimaRevisionISO": "2026-05-20",
        "mesesSinRevision": 3
      },
      {
        "canal": "Buscador",
        "rows": 17,
        "rowsConMonto": 17,
        "ingresosCRC": 959449,
        "pctIngresos": 1.8,
        "pctRows": 1.9,
        "ticketPromedioCRC": 56438,
        "ultimaRevisionISO": "2026-08-19",
        "mesesSinRevision": 0
      },
      {
        "canal": "(sin canal)",
        "rows": 5,
        "rowsConMonto": 5,
        "ingresosCRC": 301096,
        "pctIngresos": 0.6,
        "pctRows": 0.6,
        "ticketPromedioCRC": 60219,
        "ultimaRevisionISO": "2026-03-18",
        "mesesSinRevision": 5
      }
    ],
    "porMes": [
      {
        "ym": "2025-04",
        "enCurso": false,
        "rows": 7,
        "ingresosCRC": 343000,
        "publicidadCRC": 0,
        "canales": [
          {
            "canal": "(sin canal)",
            "rows": 3,
            "ingresosCRC": 147000
          },
          {
            "canal": "TikTok",
            "rows": 2,
            "ingresosCRC": 98000
          },
          {
            "canal": "Recompra",
            "rows": 1,
            "ingresosCRC": 49000
          },
          {
            "canal": "Buscador",
            "rows": 1,
            "ingresosCRC": 49000
          }
        ]
      },
      {
        "ym": "2025-05",
        "enCurso": false,
        "rows": 62,
        "ingresosCRC": 3044000,
        "publicidadCRC": 0,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 32,
            "ingresosCRC": 1578000
          },
          {
            "canal": "Referido",
            "rows": 12,
            "ingresosCRC": 588000
          },
          {
            "canal": "Recompra",
            "rows": 8,
            "ingresosCRC": 388000
          },
          {
            "canal": "TikTok",
            "rows": 6,
            "ingresosCRC": 294000
          },
          {
            "canal": "Buscador",
            "rows": 4,
            "ingresosCRC": 196000
          }
        ]
      },
      {
        "ym": "2025-06",
        "enCurso": false,
        "rows": 70,
        "ingresosCRC": 3446000,
        "publicidadCRC": 0,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 35,
            "ingresosCRC": 1725000
          },
          {
            "canal": "Recompra",
            "rows": 13,
            "ingresosCRC": 643000
          },
          {
            "canal": "Referido",
            "rows": 10,
            "ingresosCRC": 490000
          },
          {
            "canal": "TikTok",
            "rows": 10,
            "ingresosCRC": 490000
          },
          {
            "canal": "Buscador",
            "rows": 2,
            "ingresosCRC": 98000
          }
        ]
      },
      {
        "ym": "2025-07",
        "enCurso": false,
        "rows": 74,
        "ingresosCRC": 3651000,
        "publicidadCRC": 0,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 47,
            "ingresosCRC": 2332000
          },
          {
            "canal": "TikTok",
            "rows": 12,
            "ingresosCRC": 588000
          },
          {
            "canal": "Recompra",
            "rows": 8,
            "ingresosCRC": 388000
          },
          {
            "canal": "Referido",
            "rows": 7,
            "ingresosCRC": 343000
          }
        ]
      },
      {
        "ym": "2025-08",
        "enCurso": false,
        "rows": 41,
        "ingresosCRC": 2086162,
        "publicidadCRC": 470200,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 24,
            "ingresosCRC": 1220988
          },
          {
            "canal": "Referido",
            "rows": 6,
            "ingresosCRC": 294000
          },
          {
            "canal": "Recompra",
            "rows": 6,
            "ingresosCRC": 294000
          },
          {
            "canal": "TikTok",
            "rows": 3,
            "ingresosCRC": 170086
          },
          {
            "canal": "Buscador",
            "rows": 2,
            "ingresosCRC": 107088
          }
        ]
      },
      {
        "ym": "2025-09",
        "enCurso": false,
        "rows": 31,
        "ingresosCRC": 1860910,
        "publicidadCRC": 426314,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 14,
            "ingresosCRC": 890967
          },
          {
            "canal": "Recompra",
            "rows": 11,
            "ingresosCRC": 596302
          },
          {
            "canal": "Buscador",
            "rows": 2,
            "ingresosCRC": 131269
          },
          {
            "canal": "Referido",
            "rows": 2,
            "ingresosCRC": 121212
          },
          {
            "canal": "TikTok",
            "rows": 2,
            "ingresosCRC": 121160
          }
        ]
      },
      {
        "ym": "2025-10",
        "enCurso": false,
        "rows": 36,
        "ingresosCRC": 2335014,
        "publicidadCRC": 388914,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 25,
            "ingresosCRC": 1643620
          },
          {
            "canal": "Recompra",
            "rows": 5,
            "ingresosCRC": 295172
          },
          {
            "canal": "Referido",
            "rows": 3,
            "ingresosCRC": 188595
          },
          {
            "canal": "(sin canal)",
            "rows": 1,
            "ingresosCRC": 90583
          },
          {
            "canal": "Buscador",
            "rows": 1,
            "ingresosCRC": 67871
          },
          {
            "canal": "TikTok",
            "rows": 1,
            "ingresosCRC": 49173
          }
        ]
      },
      {
        "ym": "2025-11",
        "enCurso": false,
        "rows": 47,
        "ingresosCRC": 2957919,
        "publicidadCRC": 392788,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 40,
            "ingresosCRC": 2500784
          },
          {
            "canal": "Recompra",
            "rows": 3,
            "ingresosCRC": 215141
          },
          {
            "canal": "Referido",
            "rows": 3,
            "ingresosCRC": 192773
          },
          {
            "canal": "Buscador",
            "rows": 1,
            "ingresosCRC": 49221
          }
        ]
      },
      {
        "ym": "2025-12",
        "enCurso": false,
        "rows": 23,
        "ingresosCRC": 1427692,
        "publicidadCRC": 368276,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 19,
            "ingresosCRC": 1183070
          },
          {
            "canal": "Recompra",
            "rows": 3,
            "ingresosCRC": 183534
          },
          {
            "canal": "Referido",
            "rows": 1,
            "ingresosCRC": 61088
          }
        ]
      },
      {
        "ym": "2026-01",
        "enCurso": false,
        "rows": 51,
        "ingresosCRC": 3178412,
        "publicidadCRC": 460051,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 45,
            "ingresosCRC": 2816724
          },
          {
            "canal": "Recompra",
            "rows": 6,
            "ingresosCRC": 361688
          }
        ]
      },
      {
        "ym": "2026-02",
        "enCurso": false,
        "rows": 45,
        "ingresosCRC": 2776817,
        "publicidadCRC": 458195,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 40,
            "ingresosCRC": 2435335
          },
          {
            "canal": "Referido",
            "rows": 3,
            "ingresosCRC": 221303
          },
          {
            "canal": "Recompra",
            "rows": 2,
            "ingresosCRC": 120179
          }
        ]
      },
      {
        "ym": "2026-03",
        "enCurso": false,
        "rows": 53,
        "ingresosCRC": 3422600,
        "publicidadCRC": 459878,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 38,
            "ingresosCRC": 2377500
          },
          {
            "canal": "Recompra",
            "rows": 8,
            "ingresosCRC": 591587
          },
          {
            "canal": "Referido",
            "rows": 4,
            "ingresosCRC": 257000
          },
          {
            "canal": "Buscador",
            "rows": 1,
            "ingresosCRC": 69000
          },
          {
            "canal": "TikTok",
            "rows": 1,
            "ingresosCRC": 64000
          },
          {
            "canal": "(sin canal)",
            "rows": 1,
            "ingresosCRC": 63513
          }
        ]
      },
      {
        "ym": "2026-04",
        "enCurso": false,
        "rows": 50,
        "ingresosCRC": 3163000,
        "publicidadCRC": 485957,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 46,
            "ingresosCRC": 2927000
          },
          {
            "canal": "Recompra",
            "rows": 3,
            "ingresosCRC": 177000
          },
          {
            "canal": "Referido",
            "rows": 1,
            "ingresosCRC": 59000
          }
        ]
      },
      {
        "ym": "2026-05",
        "enCurso": false,
        "rows": 64,
        "ingresosCRC": 4130617,
        "publicidadCRC": 474045,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 53,
            "ingresosCRC": 3457080
          },
          {
            "canal": "Recompra",
            "rows": 7,
            "ingresosCRC": 429537
          },
          {
            "canal": "Referido",
            "rows": 2,
            "ingresosCRC": 128000
          },
          {
            "canal": "TikTok",
            "rows": 2,
            "ingresosCRC": 116000
          }
        ]
      },
      {
        "ym": "2026-06",
        "enCurso": false,
        "rows": 85,
        "ingresosCRC": 5515000,
        "publicidadCRC": 301000,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 72,
            "ingresosCRC": 4665000
          },
          {
            "canal": "Recompra",
            "rows": 9,
            "ingresosCRC": 591000
          },
          {
            "canal": "Referido",
            "rows": 4,
            "ingresosCRC": 259000
          }
        ]
      },
      {
        "ym": "2026-07",
        "enCurso": false,
        "rows": 76,
        "ingresosCRC": 4937141,
        "publicidadCRC": 272000,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 65,
            "ingresosCRC": 4232141
          },
          {
            "canal": "Recompra",
            "rows": 6,
            "ingresosCRC": 374000
          },
          {
            "canal": "Referido",
            "rows": 5,
            "ingresosCRC": 331000
          }
        ]
      },
      {
        "ym": "2026-08",
        "enCurso": true,
        "rows": 67,
        "ingresosCRC": 4194000,
        "publicidadCRC": 70200,
        "canales": [
          {
            "canal": "Mercadeo",
            "rows": 45,
            "ingresosCRC": 2897000
          },
          {
            "canal": "Referido",
            "rows": 10,
            "ingresosCRC": 635000
          },
          {
            "canal": "Recompra",
            "rows": 9,
            "ingresosCRC": 470000
          },
          {
            "canal": "Buscador",
            "rows": 3,
            "ingresosCRC": 192000
          }
        ]
      }
    ],
    "publicidad": {
      "totalCRC": 5027818,
      "canalAtribuido": "Mercadeo",
      "mesesConPauta": 13,
      "mesesSinPautaRegistrada": 3,
      "rowsAtribuidas": 526,
      "ingresosAtribuidosCRC": 33247209,
      "rowsCanalTotal": 640,
      "costoPorRevisionCRC": 9559,
      "retornoPorColon": 6.61
    },
    "nota": "Datos reales de producción al 24-ago-2026, congelados para la revisión visual."
  };

export default function DevCanalesPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — datos reales congelados al
        24-ago-2026. No existe en producción.
      </div>
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        <ChannelDashboard data={MUESTRA} />
      </div>
    </>
  );
}
