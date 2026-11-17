import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

export class ModelFiles {
  private static readonly loaded = new Map<string, Promise<GLTF>>();

  static load(url: string): Promise<GLTF> {
    const known = ModelFiles.loaded.get(url);
    if (known) return known;
    const loading = new GLTFLoader().loadAsync(url);
    ModelFiles.loaded.set(url, loading);
    return loading;
  }

  static copy(gltf: GLTF): THREE.Object3D {
    return clone(gltf.scene);
  }
}

export class ClipPoses {
  static readonly HIPS = /hips|pelvis/i;
  static readonly MOVED = 0.15;
  private static readonly settled = new WeakMap<GLTF, Map<string, boolean>>();

  static hips(root: THREE.Object3D): THREE.Object3D | null {
    let found: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (!found && (node as THREE.Bone).isBone && ClipPoses.HIPS.test(node.name)) found = node;
    });
    return found;
  }

  static settles(gltf: GLTF, name: string): boolean {
    const known = ClipPoses.settled.get(gltf) ?? new Map<string, boolean>();
    ClipPoses.settled.set(gltf, known);
    const cached = known.get(name);
    if (cached !== undefined) return cached;
    const clip = gltf.animations.find((entry) => entry.name === name);
    const root = ModelFiles.copy(gltf);
    const hips = ClipPoses.hips(root);
    let moved = false;
    if (clip && hips) {
      const tall = ModelFit.measure(root).getSize(new THREE.Vector3()).y;
      const mixer = new THREE.AnimationMixer(root);
      const action = mixer.clipAction(clip);
      action.play();
      const pose = (time: number) => {
        action.time = time;
        mixer.update(0);
        root.updateMatrixWorld(true);
        return hips.getWorldPosition(new THREE.Vector3());
      };
      moved = pose(0).distanceTo(pose(clip.duration - 0.001)) > ClipPoses.MOVED * tall;
    }
    known.set(name, moved);
    return moved;
  }
}

export function useModelFiles(urls: readonly string[]): Record<string, GLTF> | null {
  const key = [...new Set(urls)].sort().join("\n");
  const [files, setFiles] = useState<Record<string, GLTF> | null>(key ? null : {});
  const [handle] = useState(() => (key ? delayRender("3d models") : null));
  useEffect(() => {
    if (!key) return;
    const list = key.split("\n");
    Promise.all(list.map((url) => ModelFiles.load(url)))
      .then((loaded) => {
        setFiles(Object.fromEntries(list.map((url, i) => [url, loaded[i]])));
        if (handle !== null) continueRender(handle);
      })
      .catch((error: unknown) => cancelRender(error));
  }, [key, handle]);
  return files;
}

export class ModelFit {
  static measure(root: THREE.Object3D): THREE.Box3 {
    root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(root);
  }

  static standOn(root: THREE.Object3D, tall: number): THREE.Group {
    const box = ModelFit.measure(root);
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 0 ? tall / size.y : 1;
    const holder = new THREE.Group();
    root.position.set(
      -((box.min.x + box.max.x) / 2) * scale,
      -box.min.y * scale,
      -((box.min.z + box.max.z) / 2) * scale,
    );
    root.scale.setScalar(scale);
    holder.add(root);
    return holder;
  }

  static shadows(root: THREE.Object3D): void {
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    });
  }
}
