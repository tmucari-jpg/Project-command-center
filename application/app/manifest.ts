import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Command Center",
    short_name: "PCC",
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
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
