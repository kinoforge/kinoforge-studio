import { z } from "zod";
import { text } from "../fields.ts";

export const ROAD_LAYOUTS = [
  "straight",
  "motorway",
  "crossroads",
  "junction",
  "roundabout",
  "car-park",
] as const;
export type RoadLayout = (typeof ROAD_LAYOUTS)[number];
/** The arms of a road, named from the learner's car, which always drives up the screen. */
export const ROAD_ARMS = ["back", "left", "ahead", "right"] as const;
export type RoadArm = (typeof ROAD_ARMS)[number];
export const ROAD_CARS = ["you", "car-1", "car-2", "car-3", "bike", "truck"] as const;
export type RoadCar = (typeof ROAD_CARS)[number];
export const ROAD_LANES = ["left", "middle", "right"] as const;
export type RoadLane = (typeof ROAD_LANES)[number];
export const ROAD_LOOKS = [
  "ahead",
  "left",
  "right",
  "behind",
  "left-shoulder",
  "right-shoulder",
] as const;
export type RoadLook = (typeof ROAD_LOOKS)[number];
export const TRAFFIC_SIDES = ["right", "left"] as const;
export type TrafficSide = (typeof TRAFFIC_SIDES)[number];
export const SIGN_KINDS = [
  "stop",
  "give-way",
  "speed-limit",
  "no-entry",
  "roundabout",
  "priority-road",
  "crossing",
  "no-overtaking",
  "danger",
  "no-parking",
  "no-stopping",
] as const;
export type SignKind = (typeof SIGN_KINDS)[number];
export const LIGHT_STATES = ["red", "amber", "green"] as const;
export type LightState = (typeof LIGHT_STATES)[number];

const car = z.enum(ROAD_CARS);

export const roadPiece = z.object({
  type: z.literal("road"),
  layout: z.enum(ROAD_LAYOUTS),
  lanes: z.int().min(1).max(3).optional(),
});
export const drivePiece = z.object({
  type: z.literal("drive"),
  car,
  from: z.enum(ROAD_ARMS).optional(),
  to: z.enum(["stop", ...ROAD_ARMS]),
  lane: z.enum(ROAD_LANES).optional(),
  label: text(18).optional(),
});
export const signalPiece = z.object({
  type: z.literal("signal"),
  car,
  side: z.enum(["left", "right", "off"]),
});
export const lookPiece = z.object({
  type: z.literal("look"),
  car: car.optional(),
  toward: z.enum(ROAD_LOOKS),
  label: text(18).optional(),
});
export const measurePiece = z.object({
  type: z.literal("measure"),
  car: car.optional(),
  parts: z
    .array(z.object({ label: text(16), value: z.number().positive() }))
    .min(1)
    .max(3),
  unit: z.string().max(6).optional(),
});
export const crossPiece = z.object({
  type: z.literal("cross"),
  at: z.enum(ROAD_ARMS),
});
export const lightPiece = z.object({
  type: z.literal("light"),
  at: z.enum(ROAD_ARMS).optional(),
  state: z.enum(LIGHT_STATES),
});
export const parkPiece = z.object({
  type: z.literal("park"),
  car: car.optional(),
});
export const signPiece = z.object({
  type: z.literal("sign"),
  kind: z.enum(SIGN_KINDS),
  value: z.int().min(5).max(200).optional(),
  label: text(32).optional(),
});

export const roadStageSchema = z.object({ side: z.enum(TRAFFIC_SIDES) });

export type DrivePiece = z.infer<typeof drivePiece>;
export type MeasurePart = z.infer<typeof measurePiece>["parts"][number];
