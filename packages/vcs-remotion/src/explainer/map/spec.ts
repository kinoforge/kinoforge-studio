import { z } from "zod";
import { slug, text } from "../fields.ts";
import { MARK_TONES } from "../diagram/spec.ts";

export const MAP_REGIONS = [
  "world",
  "europe",
  "asia",
  "africa",
  "north-america",
  "south-america",
  "oceania",
  "middle-east",
] as const;
export type MapRegion = (typeof MAP_REGIONS)[number];
export const ROUTE_MODES = ["plane", "ship", "car", "line"] as const;
export type RouteMode = (typeof ROUTE_MODES)[number];

const placeId = slug.describe("a place id from STAGE");
const country = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/)
  .describe("an ISO 3166 alpha-3 code, like ITA");

export const mapPiece = z.object({ type: z.literal("map"), region: z.enum(MAP_REGIONS) });
export const pinPiece = z.object({
  type: z.literal("pin"),
  places: z.array(placeId).min(1).max(4),
});
export const routePiece = z.object({
  type: z.literal("route"),
  from: placeId,
  to: placeId,
  via: z.array(placeId).max(3).optional(),
  mode: z.enum(ROUTE_MODES).optional(),
  label: text(16).optional(),
});
export const zonePiece = z.object({
  type: z.literal("zone"),
  countries: z.array(country).min(1).max(8),
  tone: z.enum(MARK_TONES).optional(),
  label: text(18).optional(),
});

export const stagePlaceSchema = z.object({
  id: slug.describe("short kebab-case, unique"),
  label: text(18),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type StagePlace = z.infer<typeof stagePlaceSchema>;
