import { useMemo } from "react";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { type BoardPalette, BoardThemes, PAINTS } from "../shared/theme.ts";
import { ModelFiles, ModelFit } from "./models.ts";
import type { Ground, ModelPart, PropPick, SceneModel } from "./spec.ts";
import type { PropDims, PropPlace } from "./state.ts";

interface GroundLook {
  floor: string;
  back: string;
  sky: string;
  wall: boolean;
  scenery: "none" | "room" | "city" | "trees" | "stars" | "curtain";
  light: number;
}

export class GroundLooks {
  static readonly WALL_Z = -3.6;
  static readonly FAR_Z = -9;

  static of(ground: Ground, palette: BoardPalette): GroundLook {
    const wash = (colour: string, amount: number) => BoardThemes.mix(palette.background, colour, amount);
    switch (ground) {
      case "room":
        return { floor: wash("#8B5A2B", 0.45), back: wash("#FFFFFF", 0.35), sky: palette.background, wall: true, scenery: "room", light: 1.05 };
      case "street":
        return { floor: wash("#4A4A4A", 0.75), back: wash("#B9C4CF", 0.5), sky: wash("#9FC5E8", 0.6), wall: false, scenery: "city", light: 1.1 };
      case "park":
        return { floor: wash("#5DA34A", 0.7), back: wash("#9FC5E8", 0.5), sky: wash("#9FC5E8", 0.65), wall: false, scenery: "trees", light: 1.15 };
      case "stage":
        return { floor: wash("#6B4A2F", 0.7), back: wash("#8E1B2B", 0.75), sky: "#120E0C", wall: true, scenery: "curtain", light: 0.8 };
      case "space":
        return { floor: wash("#6E7480", 0.7), back: "#0B0D1A", sky: "#0B0D1A", wall: false, scenery: "stars", light: 0.9 };
      case "plain":
        return { floor: palette.background, back: palette.background, sky: palette.background, wall: false, scenery: "none", light: 1 };
    }
  }
}

class Scatter {
  static at(seed: number): number {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }
}

function Scenery({ look }: { look: GroundLook }) {
  const items = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);
  if (look.scenery === "room") {
    const trim = BoardThemes.mix(look.back, look.floor, 0.4);
    const frame = BoardThemes.mix(look.floor, "#3E2C1E", 0.45);
    const rug = BoardThemes.mix(look.floor, look.back, 0.25);
    return (
      <group>
        <mesh position={[0, 0.008, -0.35]} receiveShadow>
          <boxGeometry args={[5.4, 0.016, 2.7]} />
          <meshStandardMaterial color={rug} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.09, GroundLooks.WALL_Z + 0.02]} receiveShadow>
          <boxGeometry args={[26, 0.18, 0.04]} />
          <meshStandardMaterial color={trim} roughness={0.8} />
        </mesh>
        <group position={[-2.6, 2.35, GroundLooks.WALL_Z + 0.03]}>
          <mesh>
            <boxGeometry args={[1.7, 1.35, 0.06]} />
            <meshStandardMaterial color={frame} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.033]}>
            <planeGeometry args={[1.48, 1.13]} />
            <meshBasicMaterial color="#DCECF8" />
          </mesh>
          <mesh position={[0, 0, 0.038]}>
            <boxGeometry args={[0.05, 1.15, 0.02]} />
            <meshStandardMaterial color={frame} />
          </mesh>
          <mesh position={[0, 0, 0.038]}>
            <boxGeometry args={[1.5, 0.05, 0.02]} />
            <meshStandardMaterial color={frame} />
          </mesh>
        </group>
        <group position={[2.7, 2.25, GroundLooks.WALL_Z + 0.03]}>
          <mesh>
            <boxGeometry args={[1.15, 0.85, 0.05]} />
            <meshStandardMaterial color={frame} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.028]}>
            <planeGeometry args={[0.96, 0.66]} />
            <meshStandardMaterial color={BoardThemes.mix(look.back, "#E8A317", 0.35)} />
          </mesh>
        </group>
      </group>
    );
  }
  if (look.scenery === "city") {
    return (
      <group>
        {items.map((i) => {
          const h = 3 + Scatter.at(i + 1) * 6;
          const w = 1.6 + Scatter.at(i + 7) * 1.6;
          return (
            <mesh key={i} position={[-15 + i * 2.3, h / 2, GroundLooks.FAR_Z - Scatter.at(i + 3) * 2]} receiveShadow>
              <boxGeometry args={[w, h, 1.6]} />
              <meshStandardMaterial color={BoardThemes.mix(look.back, "#5B6573", Scatter.at(i + 5) * 0.5)} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.06, -4.2]} receiveShadow>
          <boxGeometry args={[40, 0.12, 2.2]} />
          <meshStandardMaterial color={BoardThemes.mix(look.floor, "#FFFFFF", 0.35)} />
        </mesh>
      </group>
    );
  }
  if (look.scenery === "trees") {
    return (
      <group>
        {items.map((i) => {
          const x = -16 + i * 2.4 + Scatter.at(i + 2) * 0.8;
          const z = GroundLooks.FAR_Z + 2 - Scatter.at(i + 9) * 3;
          const h = 1.8 + Scatter.at(i + 4) * 1.6;
          return (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, h * 0.25, 0]} castShadow>
                <cylinderGeometry args={[0.12, 0.16, h * 0.5, 8]} />
                <meshStandardMaterial color="#7A5434" />
              </mesh>
              <mesh position={[0, h * 0.7, 0]} castShadow>
                <coneGeometry args={[0.8, h * 0.9, 10]} />
                <meshStandardMaterial color={BoardThemes.mix("#3F8C3A", look.floor, Scatter.at(i + 6) * 0.4)} />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }
  if (look.scenery === "stars") {
    return (
      <group>
        {Array.from({ length: 90 }, (_, i) => (
          <mesh key={i} position={[-20 + Scatter.at(i + 1) * 40, 1 + Scatter.at(i + 2) * 12, GroundLooks.FAR_Z - Scatter.at(i + 3) * 4]}>
            <sphereGeometry args={[0.03 + Scatter.at(i + 4) * 0.05, 6, 6]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        ))}
      </group>
    );
  }
  if (look.scenery === "curtain") {
    return (
      <group>
        {Array.from({ length: 24 }, (_, i) => (
          <mesh key={i} position={[-12 + i * 1.05, 4, GroundLooks.WALL_Z + 0.25 + (i % 2) * 0.12]} receiveShadow>
            <cylinderGeometry args={[0.32, 0.32, 8, 10]} />
            <meshStandardMaterial color={look.back} />
          </mesh>
        ))}
      </group>
    );
  }
  return null;
}

export function Ground3D({ ground, palette }: { ground: Ground; palette: BoardPalette }) {
  const look = GroundLooks.of(ground, palette);
  return (
    <>
      <color attach="background" args={[look.sky]} />
      <hemisphereLight args={["#FFF6E5", BoardThemes.mix(look.floor, "#222222", 0.25), 1.35 * look.light]} />
      <directionalLight
        position={[5, 10, 7]}
        intensity={1.9 * look.light}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={10}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-6, 4.5, 6]} intensity={0.95 * look.light} color="#EAF2FF" />
      <directionalLight position={[0, 5, -6]} intensity={0.6 * look.light} color="#FFF4DC" />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[80, 40]} />
        <meshStandardMaterial color={look.floor} />
      </mesh>
      {look.wall ? (
        <mesh position={[0, 6, GroundLooks.WALL_Z]} receiveShadow>
          <planeGeometry args={[80, 12]} />
          <meshStandardMaterial color={look.back} />
        </mesh>
      ) : (
        <mesh position={[0, 8, GroundLooks.FAR_Z - 6]}>
          <planeGeometry args={[120, 30]} />
          <meshBasicMaterial color={look.sky} />
        </mesh>
      )}
      <Scenery look={look} />
    </>
  );
}

export class PartShapes {
  static geometry(part: ModelPart): THREE.BufferGeometry {
    switch (part.shape) {
      case "box":
        return new THREE.BoxGeometry(1, 1, 1);
      case "ball":
        return new THREE.SphereGeometry(0.5, 20, 14);
      case "tube":
        return new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
      case "cone":
        return new THREE.ConeGeometry(0.5, 1, 20);
      case "ring":
        return new THREE.TorusGeometry(0.4, 0.1, 10, 24);
    }
  }

  static build(parts: readonly ModelPart[]): THREE.Group {
    const group = new THREE.Group();
    for (const part of parts) {
      const mesh = new THREE.Mesh(
        PartShapes.geometry(part),
        new THREE.MeshStandardMaterial({ color: PAINTS[part.paint], roughness: 0.7 }),
      );
      mesh.scale.set(...part.size);
      mesh.position.set(...part.at);
      if (part.turn) mesh.rotation.set(...part.turn);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    const box = ModelFit.measure(group);
    group.position.y = Math.max(0, -box.min.y);
    const holder = new THREE.Group();
    holder.add(group);
    return holder;
  }
}

export class PropSize {
  static of(model: SceneModel, files: Record<string, GLTF>): PropDims {
    if (model.kind === "parts") {
      const span = (axis: 0 | 1 | 2) =>
        Math.max(...model.parts.map((part) => part.at[axis] + part.size[axis] / 2)) -
        Math.min(...model.parts.map((part) => part.at[axis] - part.size[axis] / 2));
      return { tall: span(1), wide: span(0), deep: span(2) };
    }
    if (model.kind !== "file" || !files[model.url]) return { tall: 0, wide: 0, deep: 0 };
    const size = ModelFit.measure(files[model.url].scene).getSize(new THREE.Vector3());
    const scale = size.y > 0 ? model.tall / size.y : 1;
    return { tall: model.tall, wide: size.x * scale, deep: size.z * scale };
  }

  static all(models: Record<string, SceneModel>, files: Record<string, GLTF>): Record<string, PropDims> {
    return Object.fromEntries(
      Object.entries(models).flatMap(([kind, model]) => (model.kind === "rig" ? [] : [[kind, PropSize.of(model, files)]])),
    );
  }
}

export class PropObjects {
  static build(model: SceneModel, files: Record<string, GLTF>): THREE.Object3D | null {
    if (model.kind === "parts") return PartShapes.build(model.parts);
    if (model.kind === "file" && files[model.url]) {
      const root = ModelFiles.copy(files[model.url]);
      ModelFit.shadows(root);
      return ModelFit.standOn(root, model.tall);
    }
    return null;
  }

  static place(object: THREE.Object3D, place: PropPlace): void {
    object.position.set(place.x, 0, place.z);
    object.rotation.y = place.turn;
    object.scale.set(...place.scale);
  }

  static surface(model: SceneModel, files: Record<string, GLTF>, place: PropPlace, x: number, z: number): number | null {
    const object = PropObjects.build(model, files);
    if (!object) return null;
    PropObjects.place(object, place);
    object.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(x, PropObjects.ABOVE, z), new THREE.Vector3(0, -1, 0));
    return ray.intersectObject(object, true)[0]?.point.y ?? null;
  }

  static readonly ABOVE = 50;
}

function Prop3D({ model, files, place }: { model: SceneModel; files: Record<string, GLTF>; place: PropPlace }) {
  const object = useMemo(() => PropObjects.build(model, files), [model, files]);
  if (!object) return null;
  PropObjects.place(object, place);
  return <primitive object={object} />;
}

export function Props3D({
  props,
  models,
  files,
  places,
}: {
  props: readonly PropPick[];
  models: Record<string, SceneModel>;
  files: Record<string, GLTF>;
  places: ReadonlyMap<PropPick, PropPlace>;
}) {
  return (
    <>
      {props.map((pick, i) => {
        const model = models[pick.kind];
        const place = places.get(pick);
        return model && place ? <Prop3D key={`${pick.kind}-${i}`} model={model} files={files} place={place} /> : null;
      })}
    </>
  );
}
