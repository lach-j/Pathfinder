export default {
  branches: ["main"],
  tagFormat: "v${version}",
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/exec",
      {
        prepareCmd:
          "npm version ${nextRelease.version} --no-git-tag-version --workspaces=false && npm run build && npm pack"
      }
    ],
    [
      "@semantic-release/github",
      {
        assets: [
          {
            path: "pathfinder-*.tgz",
            label: "Pathfinder npm tarball"
          }
        ]
      }
    ]
  ]
};
