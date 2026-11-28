import { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  type CalculateMetadataFunction,
  continueRender,
  delayRender,
  Sequence,
  useCurrentFrame,
} from "remotion";
import { WbCamera } from "./camera.ts";
import { HandFont } from "./hand/font.ts";
import { WbPlanner } from "./plan.ts";
import { type WbFilmInput, wbFilmSchema } from "./spec.ts";
import { WbPalettes } from "./theme.ts";
import { InkView, Marker, MarkerPath } from "./view.tsx";

export const WHITEBOARD_COMPOSITION_ID = "WhiteboardFilm";
export type WhiteboardProps = WbFilmInput;

export const DEFAULT_WHITEBOARD_PROPS: WhiteboardProps = {
  fps: 60,
  width: 1080,
  height: 1920,
  scenes: [{ seconds: 3, beats: [{ cue: "hello", piece: { type: "title", text: "Hello" } }] }],
};

export const whiteboardCalcMeta: CalculateMetadataFunction<WhiteboardProps> = ({ props }) => {
  const film = wbFilmSchema.parse(props);
  return {
    durationInFrames: Math.max(1, Math.ceil(WbPlanner.plan(film).seconds * film.fps)),
    fps: film.fps,
    width: film.width,
    height: film.height,
  };
};

function Grain({ amount, dark }: { amount: number; dark: boolean }) {
  const tile = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="4"/><feColorMatrix type="saturate" values="0"/></filter><rect width="320" height="320" filter="url(#n)"/></svg>`,
  );
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("data:image/svg+xml,${tile}")`,
        opacity: amount,
        mixBlendMode: dark ? "screen" : "multiply",
      }}
    />
  );
}

export function WhiteboardFilm(props: WhiteboardProps) {
  const film = useMemo(() => wbFilmSchema.parse(props), [props]);
  const plan = useMemo(() => WbPlanner.plan(film), [film]);
  const marker = useMemo(() => MarkerPath.of(plan.inks), [plan]);
  const [hold] = useState(() => delayRender("whiteboard hand font"));
  useEffect(() => {
    HandFont.load()
      .catch(() => undefined)
      .finally(() => continueRender(hold));
  }, [hold]);
  const frame = useCurrentFrame();
  const t = frame / film.fps;
  const { width: w, height: h } = film;
  const unit = Math.min(w, h);
  const palette = WbPalettes.of(film.theme);
  const view = WbCamera.at(t, plan.panels, w, h);
  const pen = film.marker && t < plan.panels[plan.panels.length - 1].end ? marker.at(t, view, w, h) : null;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.board }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${w / 2} ${h / 2}) scale(${view.zoom}) translate(${-view.cx} ${-view.cy})`}>
          {plan.inks.map((ink, i) => (ink.kind === "text" && ink.halo ? null : <InkView key={i} ink={ink} t={t} id={`wb${i}`} />))}
          {plan.inks.map((ink, i) => (ink.kind === "text" && ink.halo ? <InkView key={i} ink={ink} t={t} id={`wb${i}`} /> : null))}
        </g>
      </svg>
      <Grain amount={palette.grain} dark={film.theme === "chalkboard"} />
      {pen && (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <Marker tip={pen.tip} color={pen.color} down={pen.down} unit={unit} palette={palette} t={t} />
        </svg>
      )}
      {plan.voices.map((voice) => (
        <Sequence
          key={`${voice.start}:${voice.src}`}
          from={Math.round(voice.start * film.fps)}
          durationInFrames={Math.max(1, Math.round((voice.end - voice.start) * film.fps))}
        >
          <Audio src={voice.src} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
