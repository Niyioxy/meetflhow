import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/blog", "/about", "/contact", "/solutions", "/features"],
      disallow: [
        "/api/",
        "/billing",
        // Private per-link pages (a booking invite and a call room).
        "/book",
        "/call",
        "/dashboard",
        "/meetings",
        "/settings",
        "/calendar",
        "/insights",
        "/record",
        "/upload",
        "/schedule-meeting",
        "/onboarding",
        "/team",
        "/todos",
        "/tasks",
        "/invite",
        "/share",
        "/extension",
        "/integrations",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
