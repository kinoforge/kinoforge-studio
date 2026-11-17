import { Composition } from "remotion";
import {
  CAPTIONED_COMPOSITION_ID,
  CaptionedComposition,
  DEFAULT_CAPTIONED_PROPS,
  captionedCalcMeta,
} from "./captioned-composition.tsx";
import {
  CLIP_COMPOSITION_ID,
  ClipComposition,
  DEFAULT_CLIP_PROPS,
  clipCalcMeta,
} from "./clip-composition.tsx";
import {
  DEFAULT_EXPLAINER_PROPS,
  EXPLAINER_COMPOSITION_ID,
  ExplainerScene,
  explainerCalcMeta,
} from "./animated/explainer/composition.tsx";
import {
  DEFAULT_SKIT_PROPS,
  SKIT_COMPOSITION_ID,
  SkitScene,
  skitCalcMeta,
} from "./animated/skit/composition.tsx";
import {
  DEFAULT_SKIT3D_PROPS,
  SKIT3D_COMPOSITION_ID,
  Skit3DScene,
  skit3dCalcMeta,
} from "./animated/skit3d/composition.tsx";
import {
  DEFAULT_STORY_PROPS,
  STORY_COMPOSITION_ID,
  StoryVideo,
  storyCalcMeta,
} from "./story-composition.tsx";

export function RemotionRoot() {
  return (
    <>
      <Composition
        id={CLIP_COMPOSITION_ID}
        component={ClipComposition}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={DEFAULT_CLIP_PROPS}
        calculateMetadata={clipCalcMeta}
      />
      <Composition
        id={CAPTIONED_COMPOSITION_ID}
        component={CaptionedComposition}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={DEFAULT_CAPTIONED_PROPS}
        calculateMetadata={captionedCalcMeta}
      />
      <Composition
        id={STORY_COMPOSITION_ID}
        component={StoryVideo}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={DEFAULT_STORY_PROPS}
        calculateMetadata={storyCalcMeta}
      />
      <Composition
        id={EXPLAINER_COMPOSITION_ID}
        component={ExplainerScene}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={DEFAULT_EXPLAINER_PROPS}
        calculateMetadata={explainerCalcMeta}
      />
      <Composition
        id={SKIT_COMPOSITION_ID}
        component={SkitScene}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={DEFAULT_SKIT_PROPS}
        calculateMetadata={skitCalcMeta}
      />
      <Composition
        id={SKIT3D_COMPOSITION_ID}
        component={Skit3DScene}
        durationInFrames={120}
        fps={30}
        width={1280}
        height={720}
        defaultProps={DEFAULT_SKIT3D_PROPS}
        calculateMetadata={skit3dCalcMeta}
      />
    </>
  );
}
