import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Command Center",
    short_name: "PCC",
    description: "Centro de execução de projectos, actividades, entregáveis e métricas.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f8f6f0",
    theme_color: "#073f36",
    orientation: "portrait-primary",
    lang: "pt-MZ",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/brand/pcc-logo.png",
        sizes: "550x182",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
