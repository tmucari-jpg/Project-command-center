import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Command Center",
    short_name: "PCC",
    id: "/",
    description: "Centro de governança, decisão, execução, entregáveis e métricas de projectos.",
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
        src: "/icons/pcc-app-icon-v2.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/pcc-app-icon-maskable-v2.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
