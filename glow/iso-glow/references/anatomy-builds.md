# Anatomy builds (a real object: exploded, sectioned, labelled)

Use when the user wants a real object taken apart: a lens, a camera, a watch, an engine. Each item below was a round of user feedback on the reference build, so do them all in the first version. Reference: `assets/examples/lens-camera-3d.js` (a 50 mm lens on a mirrorless body); read only the `// ──` section you need.

1. **Research first, then stop.** Use real sources: patents, service manuals, teardowns, maker diagrams. Save the true dimensions, the part list and the real disassembly order, each with its source. Show the user the key numbers before modelling. Name brands only descriptively; put no logos or marks on the model.
2. **Build at real scale with real silhouettes.** Use bevelled extrusions, lathes and lofts through two or three rounded sections, not boxes ("too squarish" is the usual first complaint). Compare the silhouette with a reference photo, especially humps, grips and other organic shapes.
3. **Make lines complete and clearly visible.**
   - Outlines must stand clearly apart from every shading band, without glaring. Tune `THEMES.light/dark` `line`/`major`/`edge` per page.
   - Creases miss smooth edges, so add lines where rounded edges turn (tangent edges) and at every joint between parts. Push joint lines past any bevel so they show.
   - Draw slots and cut-outs as closed loops, with no dangling ends.
4. **Shade in steps, and keep texture subtle.** Use four stepped bands by facing, plus real texture where the object has it: leather grain on the body, axial ribs on grip rings, turned grooves on metal. Start at medium strength; users flagged both "too plain" and "too obvious".
5. **Explode by assembly.**
   - Give each major unit its own button (e.g. *Explode lens*, *Explode camera*).
   - Parts leave in real teardown order and along real directions. Each assembly carries its own seams and screws.
   - Nothing may end up hidden behind another part.
   - The view eases to fit the exploded state.
   - Exploding never switches the section view on or off.
6. **Label the exploded view like a service-manual plate.**
   - Labels appear only when exploded. Each has a short caps title and one line with a true number, joined to its part by a thin leader.
   - Desktop: two columns stacked by measured height so labels never overlap; fade out the info panel while labels show.
   - Phones: numbered pins plus a scrollable legend.
   - Rewrite the DOM only when the projected positions change.
7. **Section cut.**
   - Make it a toggle, off by default, remembered in `localStorage`.
   - Use half geometry with hatched cap faces, or a global clipping plane (`renderer.localClippingEnabled`; patch custom shaders with the clipping chunks).
   - Give the cut outline a clearly heavier line, about 2 px, than the hairlines.
8. **Compute anything that flows**: light, air, fluid, current. Use real data (e.g. trace rays through the real prescription with Snell's law). Paths must enter from off-screen, never start in mid-air, and their numbers go in the readout.
9. **Mobile (< 720 px):**
   - The button panel becomes a swipeable bottom toolbar with short labels and 38 px tap targets.
   - Hide the info panel; the readout sits above the toolbar.
   - Labels switch to pins plus legend (item 6).
10. **Report honestly.** When handing over, say which dimensions come from sources and which are approximations.

Shader gotcha: in `onBeforeCompile`, every `#include <…>` must start on its own line or the material silently fails to compile.
