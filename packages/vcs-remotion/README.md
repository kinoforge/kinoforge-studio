# @vcs/remotion

Shared Remotion compositions and the edit-document contract for Kinoforge Studio.
One set of composition code drives both the browser `<Player>` preview and the
headless render, so what you preview is what you render.

## What's here

- **Compositions.** `Clip` (cut plus crop/scale plus optional captions), `Captioned`
  (burn a caption track onto a base clip), `Story` (assemble images or clips with voiceover,
  captions, and music). Registered in `RemotionRoot` for the renderer.
- **Crop math.** `ClipGeometry` (`resolveCrop`, `cropDims`, `formatDims`, `cropForFormat`,
  `durationInFrames`). The fast ffmpeg render lane reuses it so its output matches the
  composition.
- **Captions.** `CaptionTrack.activeAt` picks the caption on screen at a time.
- **Animated: explainer.** `ExplainerScene` draws one scene as a board: cards, charts, a terminal, a
  stamp, icons and a talking SVG mascot, appearing on the narration's words and laid out on
  their own (a board never sets a position). The board is data checked by `boardSchema`.
  `ExplainerKit.describe()` turns `src/animated/explainer` into the data a writer model and a
  picker need: the JSON schema, each piece's field format and example, the surfaces, the icon
  list and the named assets (themes, mascots, hats, icons). The kit holds no writing rules:
  the caller keeps those in its own prompts and fills them with this data. Icons live in
  `icons/` in groups (general, science, engineering): Lucide's, plus the few it lacks drawn on
  its grid in `drawn.ts`. Add a piece in `spec.ts` and its view in `pieces/`. Diagram pieces
  (`show`, `flow`, `broadcast`, `mark`, `hide`, in `diagram/`) draw nodes and arrows that are
  laid out from the arrows alone, with packets travelling along them. The diagram carries
  from scene to scene: a scene gets the boards before it (`history`) and the video's `stage`,
  the nodes every board names. Code pieces (`code`, `focus`, in `code/`) write in an editor
  the same way: the stage holds the video's short code files, `code` types a file in a few
  lines at a time, and `focus` lights the lines a board quotes and dims the rest. Road pieces
  (`road`, `drive`, `signal`, `look`, `measure`, `cross`, in `road/`) play a driving lesson on a
  road seen from above (straight, crossroads, T junction, roundabout): arms are named from the
  learner's car, every lane and turn is worked out for traffic on the right, and the stage's
  `road.side` mirrors it for traffic on the left. Motorways, car parks, traffic lights (`light`)
  and parking (`park`) are part of it. `sign` is a road sign card for any scene. Map pieces
  (`map`, `pin`, `route`, `zone`, in `map/`) draw on a map of the world (Natural Earth 1:110m,
  public domain, in `map/world.ts`): pins on the stage's `places`, routes with a plane, ship or
  car, and countries filled by ISO code. Chart and screen cards: `line`, `pie`, `numberline`,
  `chat`, `browser`.
- **Animated: skit.** `SkitScene` (`src/animated/skit`) plays one line of a dialogue with drawn
  stick people on a flat set: the set (`setSchema`: backdrop, cast, props, a running card) and
  one line's direction (`lineSchema`: poses, faces, reactions, moves, card changes, a drawn
  board beside or full frame). A scene gets the lines before it (`history`), so places, poses
  and the card carry on. `motion` (`motionSchema`) sets how much a talking figure sways and
  gestures, how fast, how long a pose change takes and whether a speaker with no directed pose
  stays at rest. `SkitKit.describe()` gives the schemas, word lists, generated formats, the
  furniture each backdrop already draws and the motion bounds. `src/animated/shared` holds
  what both modes use: themes, fields, glyph metrics, easing, text fitting, elements, icons.
- **Edit document.** `EditDocs.parse(compositionId, inputProps)`, the one zod-validated contract
  the editor produces and the renderer consumes.

## Use

Preview (any React app):

```tsx
import { Player } from "@remotion/player";
import { ClipComposition, ClipGeometry } from "@vcs/remotion";
```

Validate a render request:

```ts
import { EditDocs } from "@vcs/remotion";
const doc = EditDocs.parse(compositionId, inputProps);
```

## License

MIT (`LICENSE`). Note that `remotion` and `@remotion/player`, which this package builds on,
are under the separate Remotion License. See the repository's [NOTICE.md](../../NOTICE.md).
