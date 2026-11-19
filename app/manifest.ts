import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StanBridge Airways",
    short_name: "StanBridge",
    description: "Search and manage StanBridge Airways journeys.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#071d32",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
