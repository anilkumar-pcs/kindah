import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kindly — small acts of kindness",
    short_name: "Kindly",
    description: "A pseudonymous micro-gifting platform for spontaneous small acts of kindness.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff7ed",
    theme_color: "#c2410c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
