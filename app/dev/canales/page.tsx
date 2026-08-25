import { notFound } from "next/navigation";
import { ChannelDashboard, type ChannelRevenue } from "@/components/bi/ChannelDashboard";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Revisión visual de **Ingresos por canal**, sin sesión y sin tocar datos.
 * 404 en producción real (mismo criterio que `/dev/finanzas`).
 *
 * Los datos son la **respuesta literal de la query contra producción**, leída el
 * 24-ago-2026 y congelada. No son de juguete a propósito: con cifras inventadas
 * no se ve que Mercadeo aplasta al resto —que es justo el problema de diseño que
 * esta pantalla tiene que resolver— ni que TikTok lleva tres meses en cero.
 *
 * Se regenera con `npx convex run --prod bi/channels:channelRevenue '{}'`.
 */
const MUESTRA: ChannelRevenue = {
    "canales": [
      {
        "canal": "Mercadeo",
        "ingresosCRC": 38882209,
        "mesesSinRevision": 0,
        "pctIngresos": 74.1,
        "pctRows": 72.6,
        "rows": 640,
        "rowsConMonto": 640,
        "ticketPromedioCRC": 60753,
        "ultimaRevisionISO": "2026-08-24"
      },
      {
        "canal": "Recompra",
        "ingresosCRC": 6167140,
        "mesesSinRevision": 0,
        "pctIngresos": 11.8,
        "pctRows": 12.2,
        "rows": 108,
        "rowsConMonto": 108,
        "ticketPromedioCRC": 57103,
        "ultimaRevisionISO": "2026-08-22"
      },
      {
        "canal": "Referido",
        "ingresosCRC": 4168971,
        "mesesSinRevision": 0,
        "pctIngresos": 7.9,
        "pctRows": 8.3,
        "rows": 73,
        "rowsConMonto": 73,
        "ticketPromedioCRC": 57109,
        "ultimaRevisionISO": "2026-08-21"
      },
      {
        "canal": "TikTok",
        "ingresosCRC": 1990419,
        "mesesSinRevision": 3,
        "pctIngresos": 3.8,
        "pctRows": 4.4,
        "rows": 39,
        "rowsConMonto": 39,
        "ticketPromedioCRC": 51036,
        "ultimaRevisionISO": "2026-05-27"
      },
      {
        "canal": "Buscador",
        "ingresosCRC": 959449,
        "mesesSinRevision": 0,
        "pctIngresos": 1.8,
        "pctRows": 1.9,
        "rows": 17,
        "rowsConMonto": 17,
        "ticketPromedioCRC": 56438,
        "ultimaRevisionISO": "2026-08-24"
      },
      {
        "canal": "(sin canal)",
        "ingresosCRC": 301096,
        "mesesSinRevision": 5,
        "pctIngresos": 0.6,
        "pctRows": 0.6,
        "rows": 5,
        "rowsConMonto": 5,
        "ticketPromedioCRC": 60219,
        "ultimaRevisionISO": "2026-03-02"
      }
    ],
    "nota": "Datos reales de producción, leídos el 24-ago-2026 y congelados para la revisión visual.",
    "porMes": [
      {
        "canales": [
          {
            "canal": "(sin canal)",
            "ingresosCRC": 147000,
            "rows": 3
          },
          {
            "canal": "TikTok",
            "ingresosCRC": 98000,
            "rows": 2
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 49000,
            "rows": 1
          },
          {
            "canal": "Buscador",
            "ingresosCRC": 49000,
            "rows": 1
          }
        ],
        "enCurso": false,
        "ingresosCRC": 343000,
        "publicidadCRC": 0,
        "rows": 7,
        "ym": "2025-04"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 1578000,
            "rows": 32
          },
          {
            "canal": "Referido",
            "ingresosCRC": 588000,
            "rows": 12
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 388000,
            "rows": 8
          },
          {
            "canal": "TikTok",
            "ingresosCRC": 294000,
            "rows": 6
          },
          {
            "canal": "Buscador",
            "ingresosCRC": 196000,
            "rows": 4
          }
        ],
        "enCurso": false,
        "ingresosCRC": 3044000,
        "publicidadCRC": 0,
        "rows": 62,
        "ym": "2025-05"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 1725000,
            "rows": 35
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 643000,
            "rows": 13
          },
          {
            "canal": "Referido",
            "ingresosCRC": 490000,
            "rows": 10
          },
          {
            "canal": "TikTok",
            "ingresosCRC": 490000,
            "rows": 10
          },
          {
            "canal": "Buscador",
            "ingresosCRC": 98000,
            "rows": 2
          }
        ],
        "enCurso": false,
        "ingresosCRC": 3446000,
        "publicidadCRC": 0,
        "rows": 70,
        "ym": "2025-06"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 2332000,
            "rows": 47
          },
          {
            "canal": "TikTok",
            "ingresosCRC": 588000,
            "rows": 12
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 388000,
            "rows": 8
          },
          {
            "canal": "Referido",
            "ingresosCRC": 343000,
            "rows": 7
          }
        ],
        "enCurso": false,
        "ingresosCRC": 3651000,
        "publicidadCRC": 481510,
        "rows": 74,
        "ym": "2025-07"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 1220988,
            "rows": 24
          },
          {
            "canal": "Referido",
            "ingresosCRC": 294000,
            "rows": 6
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 294000,
            "rows": 6
          },
          {
            "canal": "TikTok",
            "ingresosCRC": 170086,
            "rows": 3
          },
          {
            "canal": "Buscador",
            "ingresosCRC": 107088,
            "rows": 2
          }
        ],
        "enCurso": false,
        "ingresosCRC": 2086162,
        "publicidadCRC": 470200,
        "rows": 41,
        "ym": "2025-08"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 890967,
            "rows": 14
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 596302,
            "rows": 11
          },
          {
            "canal": "Buscador",
            "ingresosCRC": 131269,
            "rows": 2
          },
          {
            "canal": "Referido",
            "ingresosCRC": 121212,
            "rows": 2
          },
          {
            "canal": "TikTok",
            "ingresosCRC": 121160,
            "rows": 2
          }
        ],
        "enCurso": false,
        "ingresosCRC": 1860910,
        "publicidadCRC": 426314,
        "rows": 31,
        "ym": "2025-09"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 1643620,
            "rows": 25
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 295172,
            "rows": 5
          },
          {
            "canal": "Referido",
            "ingresosCRC": 188595,
            "rows": 3
          },
          {
            "canal": "(sin canal)",
            "ingresosCRC": 90583,
            "rows": 1
          },
          {
            "canal": "Buscador",
            "ingresosCRC": 67871,
            "rows": 1
          },
          {
            "canal": "TikTok",
            "ingresosCRC": 49173,
            "rows": 1
          }
        ],
        "enCurso": false,
        "ingresosCRC": 2335014,
        "publicidadCRC": 388914,
        "rows": 36,
        "ym": "2025-10"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 2500784,
            "rows": 40
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 215141,
            "rows": 3
          },
          {
            "canal": "Referido",
            "ingresosCRC": 192773,
            "rows": 3
          },
          {
            "canal": "Buscador",
            "ingresosCRC": 49221,
            "rows": 1
          }
        ],
        "enCurso": false,
        "ingresosCRC": 2957919,
        "publicidadCRC": 392788,
        "rows": 47,
        "ym": "2025-11"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 1183070,
            "rows": 19
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 183534,
            "rows": 3
          },
          {
            "canal": "Referido",
            "ingresosCRC": 61088,
            "rows": 1
          }
        ],
        "enCurso": false,
        "ingresosCRC": 1427692,
        "publicidadCRC": 368276,
        "rows": 23,
        "ym": "2025-12"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 2816724,
            "rows": 45
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 361688,
            "rows": 6
          }
        ],
        "enCurso": false,
        "ingresosCRC": 3178412,
        "publicidadCRC": 460051,
        "rows": 51,
        "ym": "2026-01"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 2435335,
            "rows": 40
          },
          {
            "canal": "Referido",
            "ingresosCRC": 221303,
            "rows": 3
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 120179,
            "rows": 2
          }
        ],
        "enCurso": false,
        "ingresosCRC": 2776817,
        "publicidadCRC": 458195,
        "rows": 45,
        "ym": "2026-02"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 2377500,
            "rows": 38
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 591587,
            "rows": 8
          },
          {
            "canal": "Referido",
            "ingresosCRC": 257000,
            "rows": 4
          },
          {
            "canal": "Buscador",
            "ingresosCRC": 69000,
            "rows": 1
          },
          {
            "canal": "TikTok",
            "ingresosCRC": 64000,
            "rows": 1
          },
          {
            "canal": "(sin canal)",
            "ingresosCRC": 63513,
            "rows": 1
          }
        ],
        "enCurso": false,
        "ingresosCRC": 3422600,
        "publicidadCRC": 459878,
        "rows": 53,
        "ym": "2026-03"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 2927000,
            "rows": 46
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 177000,
            "rows": 3
          },
          {
            "canal": "Referido",
            "ingresosCRC": 59000,
            "rows": 1
          }
        ],
        "enCurso": false,
        "ingresosCRC": 3163000,
        "publicidadCRC": 485957,
        "rows": 50,
        "ym": "2026-04"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 3457080,
            "rows": 53
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 429537,
            "rows": 7
          },
          {
            "canal": "Referido",
            "ingresosCRC": 128000,
            "rows": 2
          },
          {
            "canal": "TikTok",
            "ingresosCRC": 116000,
            "rows": 2
          }
        ],
        "enCurso": false,
        "ingresosCRC": 4130617,
        "publicidadCRC": 474045,
        "rows": 64,
        "ym": "2026-05"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 4665000,
            "rows": 72
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 591000,
            "rows": 9
          },
          {
            "canal": "Referido",
            "ingresosCRC": 259000,
            "rows": 4
          }
        ],
        "enCurso": false,
        "ingresosCRC": 5515000,
        "publicidadCRC": 301000,
        "rows": 85,
        "ym": "2026-06"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 4232141,
            "rows": 65
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 374000,
            "rows": 6
          },
          {
            "canal": "Referido",
            "ingresosCRC": 331000,
            "rows": 5
          }
        ],
        "enCurso": false,
        "ingresosCRC": 4937141,
        "publicidadCRC": 272000,
        "rows": 76,
        "ym": "2026-07"
      },
      {
        "canales": [
          {
            "canal": "Mercadeo",
            "ingresosCRC": 2897000,
            "rows": 45
          },
          {
            "canal": "Referido",
            "ingresosCRC": 635000,
            "rows": 10
          },
          {
            "canal": "Recompra",
            "ingresosCRC": 470000,
            "rows": 9
          },
          {
            "canal": "Buscador",
            "ingresosCRC": 192000,
            "rows": 3
          }
        ],
        "enCurso": true,
        "ingresosCRC": 4194000,
        "publicidadCRC": 70200,
        "rows": 67,
        "ym": "2026-08"
      }
    ],
    "publicidad": {
      "canalAtribuido": "Mercadeo",
      "costoPorRevisionCRC": 9615,
      "ingresosAtribuidosCRC": 35579209,
      "mesesConPauta": 14,
      "mesesSinPautaRegistrada": 2,
      "retornoPorColon": 6.46,
      "rowsAtribuidas": 573,
      "rowsCanalTotal": 640,
      "totalCRC": 5509328
    },
    "ticketPromedioCRC": 59489,
    "totalIngresosCRC": 52469284,
    "totalRows": 882,
    "totalRowsConMonto": 882
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
