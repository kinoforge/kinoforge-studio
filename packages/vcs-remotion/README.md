# @vcs/remotion

Shared Remotion compositions and the edit-document contract for VideoGPT Studio.
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
- **Explainer.** `ExplainerScene` draws one scene as a board: cards, charts, a terminal, a
  stamp, icons and a talking SVG mascot, appearing on the narration's words and laid out on
  their own (a board never sets a position). The board is data checked by `boardSchema`.
  `ExplainerKit.describe()` turns `src/explainer` into what a writer model and a picker need:
  the JSON schema, a catalog of the pieces with examples, and the named assets (themes,
  mascots, hats, icons). Add a piece in `spec.ts` and its view in `pieces/`. Diagram pieces
  (`show`, `flow`, `broadcast`, `mark`, `hide`, in `diagram/`) draw nodes and arrows that are
  laid out from the arrows alone, with packets travelling along them. The diagram carries
  from scene to scene: a scene gets the boards before it (`history`) and the video's `stage`,
  the nodes every board names. Code pieces (`code`, `focus`, in `code/`) write in an editor
  the same way: the stage holds the video's short code files, `code` types a file in a few
  lines at a time, and `focus` lights the lines a board quotes and dims the rest.
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
