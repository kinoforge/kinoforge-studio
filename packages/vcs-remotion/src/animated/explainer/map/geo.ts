import type { Box } from "../timeline.ts";
import type { MapRegion } from "./spec.ts";
import { WORLD_COUNTRIES } from "./world.ts";

export interface LonLat {
  lon: number;
  lat: number;
}

export interface XY {
  x: number;
  y: number;
}

export interface Country {
  code: string;
  name: string;
  rings: XY[][];
  /** Its main landmass's lon/lat corners, to fit a view around it. */
  corners: LonLat[];
}

/** Lon/lat boxes [west, south, east, north] a map can open on. */
const REGIONS: Record<MapRegion, [number, number, number, number]> = {
  world: [-170, -56, 180, 80],
  europe: [-24, 35, 42, 70],
  asia: [26, -10, 148, 58],
  africa: [-19, -36, 52, 38],
  "north-america": [-168, 8, -52, 72],
  "south-america": [-82, -56, -34, 13],
  oceania: [110, -48, 180, 2],
  "middle-east": [25, 12, 63, 42],
};

/** The Natural Earth projection (Šavrič et al.): the world as one calm oval, y up. */
export class Projection {
  static of({ lon, lat }: LonLat): XY {
    const l = (lon * Math.PI) / 180;
    const p = (lat * Math.PI) / 180;
    const p2 = p * p;
    const p4 = p2 * p2;
    return {
      x: l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
      y: -p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))),
    };
  }
}

/** The countries, decoded once from their polyline strings and projected. */
export class World {
  private static cache: Map<string, Country> | null = null;

  static countries(): Map<string, Country> {
    if (World.cache) return World.cache;
    World.cache = new Map(
      WORLD_COUNTRIES.split("#").map((record) => {
        const [code, name, rings] = record.split(";");
        const points = rings.split(",").map((ring) => World.ring(ring));
        // The main landmass alone, so a far territory (French Guiana) never widens a view.
        const flat = points.reduce((best, ring) => (ring.length > best.length ? ring : best));
        const lons = flat.map((p) => p.lon);
        const lats = flat.map((p) => p.lat);
        const corners = [
          { lon: Math.min(...lons), lat: Math.min(...lats) },
          { lon: Math.max(...lons), lat: Math.max(...lats) },
        ];
        return [
          code,
          { code, name, rings: points.map((ring) => ring.map(Projection.of)), corners },
        ];
      }),
    );
    return World.cache;
  }

  private static ring(encoded: string): LonLat[] {
    const out: LonLat[] = [];
    let i = 0;
    let lon = 0;
    let lat = 0;
    const next = () => {
      let shift = 0;
      let value = 0;
      let byte = 0x20;
      while (byte >= 0x20 && i < encoded.length) {
        byte = encoded.charCodeAt(i++) - 63;
        value |= (byte & 0x1f) << shift;
        shift += 5;
      }
      return value & 1 ? ~(value >> 1) : value >> 1;
    };
    while (i < encoded.length) {
      lon += next();
      lat += next();
      out.push({ lon: lon / 10, lat: lat / 10 });
    }
    return out;
  }

  /** The middle of a country's largest ring, where its label goes. */
  static middle(country: Country): XY {
    const ring = country.rings.reduce((best, r) => (r.length > best.length ? r : best));
    const sum = ring.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / ring.length, y: sum.y / ring.length };
  }
}

/** Where projected points land on screen: a scale and an offset that fit a part of the
 *  world into an area. */
export interface MapView {
  scale: number;
  x: number;
  y: number;
}

export class MapViews {
  static region(region: MapRegion): [number, number, number, number] {
    return REGIONS[region];
  }

  /** The view that fits a lon/lat box into the area, with some sea around it. */
  static fit(box: [number, number, number, number], area: Box): MapView {
    const [w, s, e, n] = box;
    const edge: XY[] = [];
    for (let k = 0; k <= 12; k++) {
      const lon = w + ((e - w) * k) / 12;
      const lat = s + ((n - s) * k) / 12;
      edge.push(
        Projection.of({ lon, lat: s }),
        Projection.of({ lon, lat: n }),
        Projection.of({ lon: w, lat }),
        Projection.of({ lon: e, lat }),
      );
    }
    const xs = edge.map((p) => p.x);
    const ys = edge.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const scale = Math.min(area.w / (x1 - x0), area.h / (y1 - y0)) * 0.94;
    return {
      scale,
      x: area.x + area.w / 2 - ((x0 + x1) / 2) * scale,
      y: area.y + area.h / 2 - ((y0 + y1) / 2) * scale,
    };
  }

  /** A box around these places and countries, never tighter than `least` degrees. */
  static around(points: LonLat[], least = 24): [number, number, number, number] | null {
    if (!points.length) return null;
    const lons = points.map((p) => p.lon);
    const lats = points.map((p) => p.lat);
    let [w, e, s, n] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
    const padLon = Math.max(least - (e - w), 0) / 2 + (e - w) * 0.18;
    const padLat = Math.max(least * 0.6 - (n - s), 0) / 2 + (n - s) * 0.22;
    [w, e, s, n] = [w - padLon, e + padLon, s - padLat, n + padLat];
    return [Math.max(-180, w), Math.max(-60, s), Math.min(180, e), Math.min(84, n)];
  }

  static mix(a: MapView, b: MapView, p: number): MapView {
    // Scale moves in log space, so zooming feels even.
    const scale = Math.exp(Math.log(a.scale) + (Math.log(b.scale) - Math.log(a.scale)) * p);
    return { scale, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
  }

  static place(view: MapView, p: XY): XY {
    return { x: view.x + p.x * view.scale, y: view.y + p.y * view.scale };
  }
}

/** The shortest way between two places over the globe, as points to draw. */
export class GreatCircle {
  static between(a: LonLat, b: LonLat, steps = 40): LonLat[] {
    const rad = Math.PI / 180;
    const [l1, p1, l2, p2] = [a.lon * rad, a.lat * rad, b.lon * rad, b.lat * rad];
    const d =
      2 *
      Math.asin(
        Math.sqrt(
          Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2,
        ),
      );
    if (d < 1e-6) return [a, b];
    let last = a.lon;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const f = i / steps;
      const A = Math.sin((1 - f) * d) / Math.sin(d);
      const B = Math.sin(f * d) / Math.sin(d);
      const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
      const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
      const z = A * Math.sin(p1) + B * Math.sin(p2);
      let lon = Math.atan2(y, x) / rad;
      // Keep the line whole across the date line: longitudes run on past 180.
      while (lon - last > 180) lon -= 360;
      while (lon - last < -180) lon += 360;
      last = lon;
      return { lon, lat: Math.atan2(z, Math.sqrt(x * x + y * y)) / rad };
    });
  }
}
