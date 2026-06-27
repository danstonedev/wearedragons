> ⚠️ **Archived.** Dormant proof-of-concept prototype ("Tier 0: Proof of Life"), no longer maintained as of 2026-06-27; no consumers or successor. Retained read-only for history. Evidence: [devpt/LEGACY-AUDIT.md](https://github.com/danstonedev/devpt/blob/claude/devpt-portfolio-analysis-whhyrm/LEGACY-AUDIT.md).

# We Are Dragons

A PlayCanvas React + TypeScript WebGL vertical slice.
This implements the "Tier 0: Proof of Life" milestone.

## Scripts

- `npm run dev`: Starts the local development server.
- `npm run build`: Type-checks and builds the production bundle for deployment.
- `npm run preview`: Locally previews the production build.

## Project Structure

- `src/App.tsx`: Main application hosting the PlayCanvas scene, the terrain generator, and the Dragon entity placeholder.
- `src/index.css`: CSS configuration ensuring the canvas takes the full viewport.

## Planning Docs

- `docs/gameplay-roadmap.md`: Implementation-ready gameplay, story, and phase roadmap for turning the prototype into a mission-based dragon action game.

## Next Steps (Tier 1)

1. **Asset Pipeline Setup**: Download the Quaternius Dragon or Cethiel's Dragon.
2. **Chunked Terrain System**: Convert the placeholder `<Render type="plane" />` to a grid-based geometry generation for "brushing" heights.
3. **Advanced Controls**: Replace the simple WASD frame loop with a proper state machine for Walk/Run/Hop/Fly/Land.
