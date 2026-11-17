import type { Board } from "../spec.ts";
import type { Stage } from "../stage.ts";
import { type Box, SurfaceSplit } from "../timeline.ts";
import { type LonLat, type MapView, MapViews, World } from "./geo.ts";
import type { MapRegion, StagePlace } from "./spec.ts";
import { MapMemory, type MapShape, MapScript } from "./state.ts";

export interface MapPlan {
  script: MapScript;
  area: Box;
  band: Box;
  places: Map<string, StagePlace>;
  /** The views the scene moves through: where it opens (null: from the start) and each
   *  region change. */
  views: { view: MapView; at: number | null }[];
  /** Where the previous scene left the map, when it showed the map too. */
  from: MapView | null;
}

export class MapScene {
  static of(
    board: Board,
    starts: readonly number[],
    seconds: number,
    history: readonly Board[],
    content: Box,
    stage: Stage | null | undefined,
  ): MapPlan | null {
    if (!MapMemory.isMap(board)) return null;
    const places = new Map((stage?.places ?? []).map((place) => [place.id, place]));
    const aside = content.w > content.h * 1.2;
    const { band, area } = SurfaceSplit.of(board, content, aside);
    const script = new MapScript(MapMemory.before(history), board.beats, starts, seconds);
    const views = script.regions.map(({ region, at }) => ({
      view: MapScene.view(region, script.shape, places, area),
      at,
    }));
    const last = history.at(-1);
    let from: MapView | null = null;
    if (last && MapMemory.isMap(last)) {
      const before = MapMemory.before(history);
      from = MapScene.view(
        before.region,
        before,
        places,
        SurfaceSplit.of(last, content, aside).area,
      );
    }
    return { script, area, band, places, views, from };
  }

  /** A region's view, or one around everything on the map, or the world. */
  static view(
    region: MapRegion | null,
    shape: MapShape,
    places: ReadonlyMap<string, StagePlace>,
    area: Box,
  ): MapView {
    if (region) return MapViews.fit(MapViews.region(region), area);
    const countries = World.countries();
    const points: LonLat[] = [
      ...[...shape.pins, ...shape.routes.flatMap((route) => route.via)].flatMap((id) => {
        const place = places.get(id);
        return place ? [place] : [];
      }),
      ...[...shape.zones.keys()].flatMap((code) => countries.get(code)?.corners ?? []),
    ];
    return MapViews.fit(MapViews.around(points) ?? MapViews.region("world"), area);
  }
}
