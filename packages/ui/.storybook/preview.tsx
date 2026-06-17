import type { Preview } from "@storybook/react-vite";

import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/review.css";
import "../src/styles/workspace.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <div className="pathfinder-storybook-shell">
        <Story />
      </div>
    )
  ],
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    backgrounds: {
      options: {
        app: { name: "Pathfinder app", value: "#101418" },
        panel: { name: "Panel", value: "#191f26" }
      }
    }
  }
};

export default preview;
