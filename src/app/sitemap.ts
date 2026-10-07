import type { MetadataRoute } from "next";

const ENTRIES: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/fleet-explorer", changeFrequency: "weekly", priority: 0.8 },
  { path: "/simulation", changeFrequency: "weekly", priority: 0.9 },
  { path: "/forecasting", changeFrequency: "weekly", priority: 0.8 },
  { path: "/scenarios", changeFrequency: "weekly", priority: 0.7 },
  { path: "/monte-carlo", changeFrequency: "weekly", priority: 0.7 },
  { path: "/maintenance", changeFrequency: "weekly", priority: 0.7 },
  { path: "/reliability", changeFrequency: "weekly", priority: 0.7 },
  { path: "/asset-health", changeFrequency: "weekly", priority: 0.7 },
  { path: "/benchmark", changeFrequency: "weekly", priority: 0.7 },
  { path: "/tender", changeFrequency: "weekly", priority: 0.7 },
  { path: "/sustainability", changeFrequency: "weekly", priority: 0.7 },
  { path: "/configure", changeFrequency: "monthly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ENTRIES.map((e) => ({
    url: e.path,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));
}
