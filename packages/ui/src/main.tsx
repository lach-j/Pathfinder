import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/review.css";
import "./styles/workspace.css";

const root = document.querySelector("#root");

if (!root) {
  throw new Error("Pathfinder UI root element was not found.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
