import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Teamplaner",
    short_name: "Teamplaner",
    description: "Kalender für Anwesenheit und Teamplanung",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8f4",
    theme_color: "#133b3e",
    icons: [
      {
        src: "/teamplaner-icon-192-v4.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/teamplaner-icon-512-v4.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/teamplaner-icon-maskable-192-v4.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/teamplaner-icon-maskable-512-v4.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
