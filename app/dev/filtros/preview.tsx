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
      "cobertura": 907,
      "etiqueta": "Canal",
      "key": "channel",
      "opciones": [
        {
          "rows": 663,
          "valor": "Mercadeo"
        },
        {
          "rows": 112,
          "valor": "Recompra"
        },
        {
          "rows": 76,
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
      "cobertura": 912,
      "etiqueta": "Provincia",
      "key": "province",
      "opciones": [
        {
          "rows": 348,
          "valor": "En agencia"
        },
        {
          "rows": 248,
          "valor": "San José"
        },
        {
          "rows": 161,
          "valor": "Heredia"
        },
        {
          "rows": 71,
          "valor": "Alajuela"
        },
        {
          "rows": 45,
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
      "cobertura": 888,
      "etiqueta": "Tipo de motor",
      "key": "engineType",
      "opciones": [
        {
          "rows": 699,
          "valor": "Gasolina"
        },
        {
          "rows": 164,
          "valor": "Diésel"
        },
        {
          "rows": 16,
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
      "aviso": "Hay 564 revisiones sin este dato; al filtrar quedan fuera.",
      "cobertura": 348,
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
        },
        {
          "rows": 6,
          "valor": "Koreautos"
        },
        {
          "rows": 5,
          "valor": "Grupo Q"
        },
        {
          "rows": 5,
          "valor": "Jarcar"
        },
        {
          "rows": 5,
          "valor": "PZ Motors"
        },
        {
          "rows": 5,
          "valor": "VillaMotors"
        },
        {
          "rows": 4,
          "valor": "Farah"
        },
        {
          "rows": 3,
          "valor": "FACO"
        },
        {
          "rows": 3,
          "valor": "Luxury Car"
        },
        {
          "rows": 3,
          "valor": "Motores Británicos"
        },
        {
          "rows": 2,
          "valor": "Ambacar"
        },
        {
          "rows": 2,
          "valor": "Autos Escazu"
        },
        {
          "rows": 2,
          "valor": "Casa"
        },
        {
          "rows": 2,
          "valor": "Élite Motors"
        },
        {
          "rows": 2,
          "valor": "Goi Cars"
        },
        {
          "rows": 2,
          "valor": "Grupo Sur"
        },
        {
          "rows": 2,
          "valor": "Promoautos zapote"
        },
        {
          "rows": 2,
          "valor": "Top Cars"
        },
        {
          "rows": 2,
          "valor": "Vehículos de Costa Rica"
        },
        {
          "rows": 1,
          "valor": "Accent VGT"
        },
        {
          "rows": 1,
          "valor": "Adjudicados DAVIVIENDA"
        },
        {
          "rows": 1,
          "valor": "Agencia Suzuki Zapote"
        },
        {
          "rows": 1,
          "valor": "Almacén fiscal EBBA"
        },
        {
          "rows": 1,
          "valor": "Amigo Rent Car"
        },
        {
          "rows": 1,
          "valor": "Amigo Renta Car"
        },
        {
          "rows": 1,
          "valor": "ANC"
        },
        {
          "rows": 1,
          "valor": "ANC Belén"
        },
        {
          "rows": 1,
          "valor": "ANC rent a car"
        },
        {
          "rows": 1,
          "valor": "Auto Acción"
        },
        {
          "rows": 1,
          "valor": "Auto repuestos San Francisco de 2 Ríos"
        },
        {
          "rows": 1,
          "valor": "AutoPremium"
        },
        {
          "rows": 1,
          "valor": "AutoPremium del éste"
        },
        {
          "rows": 1,
          "valor": "Autos 214"
        },
        {
          "rows": 1,
          "valor": "Autos 4x4"
        },
        {
          "rows": 1,
          "valor": "Autos Adrián"
        },
        {
          "rows": 1,
          "valor": "Autos Bertheu"
        },
        {
          "rows": 1,
          "valor": "Autos betel"
        },
        {
          "rows": 1,
          "valor": "Autos Bonilla calle blancos"
        },
        {
          "rows": 1,
          "valor": "Autos Costa Rica"
        },
        {
          "rows": 1,
          "valor": "Autos hermanos rojas"
        },
        {
          "rows": 1,
          "valor": "Autos Luis"
        },
        {
          "rows": 1,
          "valor": "Autos Luis 2020"
        },
        {
          "rows": 1,
          "valor": "Autos Max Grecia"
        },
        {
          "rows": 1,
          "valor": "Autos Norte Tibas"
        },
        {
          "rows": 1,
          "valor": "Autos premium"
        },
        {
          "rows": 1,
          "valor": "Autos Pripa"
        },
        {
          "rows": 1,
          "valor": "Autos san Lorenzo"
        },
        {
          "rows": 1,
          "valor": "Autos San Miguel"
        },
        {
          "rows": 1,
          "valor": "Autos San Pablo"
        },
        {
          "rows": 1,
          "valor": "Autos Santo Domingo"
        },
        {
          "rows": 1,
          "valor": "Autos Sesa"
        },
        {
          "rows": 1,
          "valor": "Autos Sibaja del Este"
        },
        {
          "rows": 1,
          "valor": "Autos Soto, San Joaquin de Flores"
        },
        {
          "rows": 1,
          "valor": "Autos Todo terreno"
        },
        {
          "rows": 1,
          "valor": "Autos tribu"
        },
        {
          "rows": 1,
          "valor": "Autos tribu Curridabat"
        },
        {
          "rows": 1,
          "valor": "Autos Usados Cr"
        },
        {
          "rows": 1,
          "valor": "Autos Yerson"
        },
        {
          "rows": 1,
          "valor": "Autos Z Motors"
        },
        {
          "rows": 1,
          "valor": "Autos, Premium del éste"
        },
        {
          "rows": 1,
          "valor": "Autosprime Uruca"
        },
        {
          "rows": 1,
          "valor": "AutoStar Santa Ana"
        },
        {
          "rows": 1,
          "valor": "Autotech"
        },
        {
          "rows": 1,
          "valor": "AUTOTECH"
        },
        {
          "rows": 1,
          "valor": "BAC adjudicados"
        },
        {
          "rows": 1,
          "valor": "BJ autos"
        },
        {
          "rows": 1,
          "valor": "BMW Uruca"
        },
        {
          "rows": 1,
          "valor": "Bodegas Terrum"
        },
        {
          "rows": 1,
          "valor": "Calle blancos"
        },
        {
          "rows": 1,
          "valor": "Calle blancos por los tribunales"
        },
        {
          "rows": 1,
          "valor": "Cars Belen"
        },
        {
          "rows": 1,
          "valor": "CARSWAP"
        },
        {
          "rows": 1,
          "valor": "Cartago Import Cars"
        },
        {
          "rows": 1,
          "valor": "Casa Conde"
        },
        {
          "rows": 1,
          "valor": "Central de autos Tibas"
        },
        {
          "rows": 1,
          "valor": "Chito Cars 2"
        },
        {
          "rows": 1,
          "valor": "CoAutos Tibás"
        },
        {
          "rows": 1,
          "valor": "Condominio terra Verbena"
        },
        {
          "rows": 1,
          "valor": "Corimotors"
        },
        {
          "rows": 1,
          "valor": "Corolla 2018"
        },
        {
          "rows": 1,
          "valor": "Costa American"
        },
        {
          "rows": 1,
          "valor": "Costa american auto"
        },
        {
          "rows": 1,
          "valor": "Costa american automotive group"
        },
        {
          "rows": 1,
          "valor": "Dongfeng"
        },
        {
          "rows": 1,
          "valor": "Dream cars Alajuela la guacima"
        },
        {
          "rows": 1,
          "valor": "EC RENTA CAR"
        },
        {
          "rows": 1,
          "valor": "Élite motors"
        },
        {
          "rows": 1,
          "valor": "Fabro Cars"
        },
        {
          "rows": 1,
          "valor": "Galería de autos"
        },
        {
          "rows": 1,
          "valor": "Garage 45"
        },
        {
          "rows": 1,
          "valor": "Grecia. Autos, Texas."
        },
        {
          "rows": 1,
          "valor": "Heredia San Francisco"
        },
        {
          "rows": 1,
          "valor": "Icons cars Belén Heredia"
        },
        {
          "rows": 1,
          "valor": "Intel"
        },
        {
          "rows": 1,
          "valor": "JFeyth"
        },
        {
          "rows": 1,
          "valor": "Kardon Car Services"
        },
        {
          "rows": 1,
          "valor": "KAUTOS"
        },
        {
          "rows": 1,
          "valor": "KIA Motors"
        },
        {
          "rows": 1,
          "valor": "Luxury, Car"
        },
        {
          "rows": 1,
          "valor": "Motor City"
        },
        {
          "rows": 1,
          "valor": "Motorcity"
        },
        {
          "rows": 1,
          "valor": "Motores transitorios"
        },
        {
          "rows": 1,
          "valor": "Multiservicios San Isidro"
        },
        {
          "rows": 1,
          "valor": "Natura renta car"
        },
        {
          "rows": 1,
          "valor": "Parque automotriz, Belén"
        },
        {
          "rows": 1,
          "valor": "Parque empresarial Oeste"
        },
        {
          "rows": 1,
          "valor": "Paseo Colón"
        },
        {
          "rows": 1,
          "valor": "Prestige Cars"
        },
        {
          "rows": 1,
          "valor": "Prime Motors"
        },
        {
          "rows": 1,
          "valor": "RAC motors"
        },
        {
          "rows": 1,
          "valor": "Repuestos conejo"
        },
        {
          "rows": 1,
          "valor": "San Francisco De 2 Rios"
        },
        {
          "rows": 1,
          "valor": "San Francisco de dos Ríos"
        },
        {
          "rows": 1,
          "valor": "San Francisco de Heredia"
        },
        {
          "rows": 1,
          "valor": "San francisco Heredia"
        },
        {
          "rows": 1,
          "valor": "San Isidro"
        },
        {
          "rows": 1,
          "valor": "San Pablo Blue Autospa"
        },
        {
          "rows": 1,
          "valor": "SML TALLER"
        },
        {
          "rows": 1,
          "valor": "Snta Bárbara"
        },
        {
          "rows": 1,
          "valor": "StarCars"
        },
        {
          "rows": 1,
          "valor": "SwapCars"
        },
        {
          "rows": 1,
          "valor": "Terramall"
        },
        {
          "rows": 1,
          "valor": "Tibas MTV cars"
        },
        {
          "rows": 1,
          "valor": "TICOCAR"
        },
        {
          "rows": 1,
          "valor": "Toyo Occidente palmares"
        },
        {
          "rows": 1,
          "valor": "TQC motors zapote"
        },
        {
          "rows": 1,
          "valor": "tu auto aqui"
        },
        {
          "rows": 1,
          "valor": "Tu auto aquí"
        },
        {
          "rows": 1,
          "valor": "Tu auto Aquí"
        },
        {
          "rows": 1,
          "valor": "Usados Suzuki"
        },
        {
          "rows": 1,
          "valor": "Valencia"
        },
        {
          "rows": 1,
          "valor": "Vega Motors"
        },
        {
          "rows": 1,
          "valor": "Veplus Motors Heredia"
        },
        {
          "rows": 1,
          "valor": "Vienes adjudicados BAC"
        },
        {
          "rows": 1,
          "valor": "Volvo Usados"
        }
      ]
    },
    {
      "aviso": null,
      "cobertura": 912,
      "etiqueta": "Marca",
      "key": "brand",
      "opciones": [
        {
          "rows": 197,
          "valor": "Hyundai"
        },
        {
          "rows": 123,
          "valor": "Toyota"
        },
        {
          "rows": 95,
          "valor": "Nissan"
        },
        {
          "rows": 79,
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
          "rows": 45,
          "valor": "BMW"
        },
        {
          "rows": 28,
          "valor": "Honda"
        },
        {
          "rows": 28,
          "valor": "Mazda"
        },
        {
          "rows": 28,
          "valor": "Otro"
        },
        {
          "rows": 23,
          "valor": "Audi"
        },
        {
          "rows": 22,
          "valor": "Chevrolet"
        },
        {
          "rows": 22,
          "valor": "Ford"
        },
        {
          "rows": 16,
          "valor": "Volkswagen"
        },
        {
          "rows": 13,
          "valor": "Mercedes-Benz"
        },
        {
          "rows": 12,
          "valor": "Geely"
        },
        {
          "rows": 10,
          "valor": "Jeep"
        },
        {
          "rows": 8,
          "valor": "Lexus"
        },
        {
          "rows": 7,
          "valor": "Land Rover"
        },
        {
          "rows": 6,
          "valor": "Daihatsu"
        },
        {
          "rows": 5,
          "valor": "(sin marca)"
        },
        {
          "rows": 5,
          "valor": "Citroën"
        },
        {
          "rows": 4,
          "valor": "Subaru"
        },
        {
          "rows": 3,
          "valor": "Dodge"
        },
        {
          "rows": 3,
          "valor": "MG"
        },
        {
          "rows": 3,
          "valor": "MINI"
        },
        {
          "rows": 3,
          "valor": "Renault"
        },
        {
          "rows": 3,
          "valor": "SsangYong"
        },
        {
          "rows": 3,
          "valor": "Volvo"
        },
        {
          "rows": 2,
          "valor": "Changan"
        },
        {
          "rows": 2,
          "valor": "Chery"
        },
        {
          "rows": 2,
          "valor": "Isuzu"
        },
        {
          "rows": 2,
          "valor": "Peugeot"
        },
        {
          "rows": 1,
          "valor": "BYD"
        },
        {
          "rows": 1,
          "valor": "Fiat"
        },
        {
          "rows": 1,
          "valor": "Jetour"
        },
        {
          "rows": 1,
          "valor": "JMC"
        }
      ]
    },
    {
      "aviso": null,
      "cobertura": 912,
      "etiqueta": "Moneda",
      "key": "currency",
      "opciones": [
        {
          "rows": 683,
          "valor": "CRC"
        },
        {
          "rows": 229,
          "valor": "USD"
        }
      ]
    },
    {
      "aviso": "Solo lo registra la app: hay dato en 171 de 912 revisiones. Al filtrar por acá, las demás quedan fuera.",
      "cobertura": 171,
      "etiqueta": "Tipo de vendedor",
      "key": "sellerType",
      "opciones": [
        {
          "rows": 90,
          "valor": "particular"
        },
        {
          "rows": 81,
          "valor": "concesionaria"
        }
      ]
    }
  ],
  "noDisponibles": [
    {
      "etiqueta": "Estado de pago",
      "motivo": "Hoy las 912 revisiones están cobradas: no hay ninguna en ₡0 ni en ₡1.000, así que el filtro tendría un solo valor y no separaría nada."
    }
  ],
  "totalRevisiones": 912
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
