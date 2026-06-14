import { reviewViewerClientScript } from "./client.js";
import { reviewViewerStyles } from "./styles.js";

export function renderReviewViewerPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Pathfinder Review</title>
    <style>
      ${reviewViewerStyles}
    </style>
  </head>
  <body>
    <main id="app" class="app">
      <section class="topbar">
        <div class="identity">
          <div class="eyebrow">Pathfinder Review</div>
          <h1>Loading local review...</h1>
          <div class="slice">Reading Pathfinder state from this repository.</div>
        </div>
      </section>
    </main>
    <script>
      ${reviewViewerClientScript}
    </script>
  </body>
</html>`;
}
