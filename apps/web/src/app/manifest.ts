import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mobsol Gas",
    short_name: "Mobsol Gas",
    description: "Order Mobsol gas cylinder exchanges, check Abuja delivery availability, and follow your orders.",
    lang: "en-NG",
    dir: "ltr",
    categories: ["shopping", "lifestyle"],
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "any",
    background_color: "#111111",
    theme_color: "#EC5E12",
    icons: [
      { src: "/icons/mobsol-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/mobsol-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Browse cylinders", short_name: "Shop", description: "Choose a Mobsol cylinder", url: "/?tab=Home", icons: [{ src: "/icons/mobsol-app-icon.svg", sizes: "any", type: "image/svg+xml" }] },
      { name: "View orders", short_name: "Orders", description: "See your order progress", url: "/?tab=Orders", icons: [{ src: "/icons/mobsol-app-icon.svg", sizes: "any", type: "image/svg+xml" }] },
      { name: "Previous orders", short_name: "Activity", description: "Review your past orders", url: "/?tab=Activity", icons: [{ src: "/icons/mobsol-app-icon.svg", sizes: "any", type: "image/svg+xml" }] },
    ],
  };
}
