# Pathfinder Documentation Migration Summary

Generated on 2026-06-16 while migrating legacy planning documentation into repo-local Pathfinder state.

## Workstreams Created

- `cli-state-foundation`: CLI And State Foundation
- `mvp-workflow-and-pr-composer`: MVP Workflow And PR Composer
- `local-review-loop`: Local Review Loop
- `agent-integration`: Agent Integration
- `distribution-and-personal-mode`: Distribution And Personal Mode
- `agent-workflow-stability`: Agent Workflow Stability
- `workspace-ui-expansion`: Workspace UI Expansion
- `review-polish-and-agent-control`: Review Polish And Agent Control
- `product-ideas-backlog`: Product Ideas Backlog
- `legacy-agent-workflow-templates`: Legacy Agent Workflow Templates

## Commit Mapping

This table covers the full visible git log at migration time. Slice-specific mappings are best-effort and use legacy doc touches, status updates, commit subjects, and nearby changed files.

| Commit | Date | Subject | Mapping |
| ------ | ---- | ------- | ------- |
| 41b3643cc8f312c95d0db67c90d964f0d8fc2ca7 | 2026-06-16T20:48:56+10:00 | docs: let pathfinder build itself | Support: pathfinder-self-hosting - repo-local Pathfinder bootstrap for self-hosting |
| 221061adc24070bbba3a510cead5f6da4993224f | 2026-06-16T20:45:19+10:00 | fix: Fix slice nodes missing handles | 43 Slice 43: Workstream Dependency Canvas |
| 620d2874ef1523e2ec36e1cd8854d50c7021a535 | 2026-06-16T20:44:46+10:00 | build: make running locally easier | Workspace UI Expansion support: local development server support |
| 89cf3453d93257f133e7fda05d44f068f13786e3 | 2026-06-16T19:46:55+10:00 | Add slice review panel to workspace shell | 45 Slice 45: Workspace Review Panel |
| b54edc6e0c51637a73c34a8017318518eec5950e | 2026-06-16T18:17:15+10:00 | docs: add additional slices | 47 Slice 47: Standalone Branch Review; 51 Slice 51: Agent PR Draft Generation; 52 Slice 52: Configurable Git Message Generation; 53 Slice 53: Agent Control CLI Layer; 54 Slice 54: Agent Session Streaming And Progress |
| a596975109fb1bcee3aabb1554acf475f70d3014 | 2026-06-16T17:49:28+10:00 | feat: add agent first-pass review workflow | 50 Slice 50: Agent First-Pass Review |
| 0e6f77551e62ecf98ce428c408d5c65b2c386c2a | 2026-06-16T17:42:08+10:00 | feat: use opaque review comment ids | 49 Slice 49: Opaque Review Comment IDs |
| f5ded4f626d7d301856b2c1639efe902b84979b9 | 2026-06-16T17:33:10+10:00 | feat: polish review diff readability | 48 Slice 48: Review UI Polish And Syntax Highlighting |
| 10379b46645fd8c6d287b06bca61dfe14121c8ea | 2026-06-16T14:06:52+10:00 | feat: add branch review workspace UI | 47 Slice 47: Standalone Branch Review |
| 590a41efb0438d1e6a78e3a48bc780c4db6a14fa | 2026-06-16T12:37:40+10:00 | feat: add artifact preview panel | 44 Slice 44: Artifact Preview Panel |
| cbceb1bfbdbde68284f7fa3a5b2e41d09c1b94f9 | 2026-06-16T12:34:51+10:00 | feat: add standalone branch review state machine | 47 Slice 47: Standalone Branch Review |
| 5c343839fbeae97e948bd2362dfb30832401598b | 2026-06-16T07:01:23+10:00 | feat: add workspace dependency canvas | 43 Slice 43: Workstream Dependency Canvas |
| 92b5e36990a53ff710249e805a75e0ed6f5ed407 | 2026-06-15T21:02:01+10:00 | feat: Add workspace shell | 42 Slice 42: Workspace Shell Current Repo |
| a4b53e5f9731f84d3c1f224da9ea701e360a719e | 2026-06-15T20:44:24+10:00 | Add workspace server and API foundation | 41 Slice 41: Workspace Server And API Foundation |
| 97e0004542a990bc72e3ad54a73ed85dafaf71eb | 2026-06-15T20:33:53+10:00 | Add workspace UI expansion slices | 41 Slice 41: Workspace Server And API Foundation; 42 Slice 42: Workspace Shell Current Repo; 43 Slice 43: Workstream Dependency Canvas; 44 Slice 44: Artifact Preview Panel; 45 Slice 45: Workspace Review Panel; 46 Slice 46: PR Rich Copy |
| 6bc02cbea1917150ba9dd1451144652042a302ca | 2026-06-15T19:55:24+10:00 | Stabilize agent prompt commands and JSON outputs | 40 Slice 40: Agent Prompt And Command Stability |
| 85183a407c207af61ac8221980dac10776117441 | 2026-06-15T19:23:33+10:00 | Add human review approval gate | 39 Slice 39: Human Review Approval Gate |
| 2dc2d43cd51ee7b69cca79a1884420ab5d529723 | 2026-06-15T19:05:39+10:00 | Require committed diffs before starting Pathfinder review | 38 Slice 38: Commit Before Review |
| aad1b5e77b706bb71083b582b3ed601cc49d100b | 2026-06-15T18:44:34+10:00 | Add slice start branch workflow | 37 Slice 37: Slice Start Branch Workflow |
| be21bf9775fa629cfaecf5d9fb12aa29f2c8ccb0 | 2026-06-15T00:20:58+10:00 | feat: Add personal doctor command | 36 Slice 36: Personal Mode Doctor |
| 1157e5453672be1325fecb2d5a86d8fe45ef19f8 | 2026-06-15T00:08:01+10:00 | Document next agent workflow stability slices | 37 Slice 37: Slice Start Branch Workflow; 38 Slice 38: Commit Before Review; 39 Slice 39: Human Review Approval Gate; 40 Slice 40: Agent Prompt And Command Stability |
| 06709e1ea8adc7862dc8f1d682e9383ea36d5bce | 2026-06-14T23:18:09+10:00 | feat: add codex agent integration | 35 Slice 35: No-Repo-Footprint Agent Mode |
| e76e3641c857c5fa6d22ddf6d3c8600d5c7b2461 | 2026-06-14T23:04:50+10:00 | Improve init setup prompts and multi-agent install | 35 Slice 35: No-Repo-Footprint Agent Mode |
| 890f612c41d89d69b838cabe4fa3fb4e987ede24 | 2026-06-14T22:57:30+10:00 | Remove global state mode config | 34 Slice 34: External State Mode |
| 20b5c1800ff6674b788c95f89e287e92da0defb1 | 2026-06-14T22:40:11+10:00 | feat: simplify pathfinder init setup | 35 Slice 35: No-Repo-Footprint Agent Mode |
| 60b2a78e436a8a478a7e17d25139bfff18866ff3 | 2026-06-14T19:00:57+10:00 | feat: add zero-repo-footprint mode | 35 Slice 35: No-Repo-Footprint Agent Mode |
| 47f68111b5b315d3ddf351d7aef64625d06a51a5 | 2026-06-14T18:47:08+10:00 | Add external state mode | 34 Slice 34: External State Mode |
| 0d23b9cac48ab4ce64bef48e98b55c0eb931e8e0 | 2026-06-14T18:35:26+10:00 | fix: disable release issue comments | 33 Slice 33: Automated Versioning |
| 8c44460b3351887e93e15f7e2d7200f11dfd8bb1 | 2026-06-14T18:33:31+10:00 | feat: enable automated releases | 33 Slice 33: Automated Versioning |
| 9758bee29c83eff9f6da5ce31fdb3a01c9145808 | 2026-06-14T18:27:39+10:00 | Add review feedback queue and draft generation flow | 33 Slice 33: Automated Versioning |
| bfd61705aa7800adf3c8b550ea32f75b7e796185 | 2026-06-14T18:20:50+10:00 | Clarify Pathfinder docs and package maps | Generic Agent Session Prompt; Support: documentation-guidance - repository guidance and package maps update |
| 01d7949a3d9826e9f907d7a76b817c60041d9f37 | 2026-06-14T16:49:30+10:00 | Add GitHub release artifact workflow | 32 Slice 32: GitHub Release Artifact Workflow |
| c2656b701fcfc554ffe50fd282b28c745a142778 | 2026-06-14T16:46:23+10:00 | Package release tarball from built workspace output | 31 Slice 31: Release Packaging |
| b94297d34764be360b1912d48ba7d20f1e27fd58 | 2026-06-14T16:38:01+10:00 | Document personal mode distribution roadmap | 31 Slice 31: Release Packaging; 32 Slice 32: GitHub Release Artifact Workflow; 33 Slice 33: Automated Versioning; 34 Slice 34: External State Mode; 35 Slice 35: No-Repo-Footprint Agent Mode; 36 Slice 36: Personal Mode Doctor |
| 5d121d1cd87bb84bd973d864c587c9fdef203a39 | 2026-06-14T16:01:39+10:00 | Add remaining idea docs and shared assumptions | Idea 07 Local MCP Server; Idea 08 Structured Agent Feedback Protocol; Idea 09 Scope Drift And Requirement Coverage; Idea 10 Review UI Depth; Idea 11 Checks And Evidence Runner; Idea 12 State Schema Validation And Repair; Idea 13 Traceability Knowledge Graph; Idea 14 Workspace UI Shell; Idea 15 Core CLI State Refactor; Idea 16 Packaging And Installation |
| 1dc83f271005cd3629b416489b9a06af424ef17e | 2026-06-14T11:50:01+10:00 | Add agent integration doctor command | 30 Slice 30: Agent Integration Doctor |
| 19b4b64d0d0d0dc846b5b251a30563201e5f0ece | 2026-06-14T11:37:35+10:00 | Add agent command install and list support | 29 Slice 29: Native Agent Command Wrappers |
| 601391395f118fbf31fdaa4d5421487f3dcfeb17 | 2026-06-14T11:34:59+10:00 | Add agent bootstrap instructions | 28 Slice 28: Agent Bootstrap Instructions |
| f14c3e03f1a34b3912f8b0c37ad8b20f1824c105 | 2026-06-14T11:28:47+10:00 | Add agent prompt rendering command | 27 Slice 27: Agent Prompt Rendering |
| 5fadbf7293ae20e56cf8107f9d2f66da975eeb57 | 2026-06-14T11:21:29+10:00 | Add agent next state machine command | 26 Slice 26: Agent Next State Machine |
| c30e8e24b845e939b220aa6ac87b58f9f1357fc0 | 2026-06-14T11:10:22+10:00 | Refactor Pathfinder workstream state and CLI flows | Local Review Loop support: workstream state and UI package refactor supporting the review workspace |
| a1688f5e5ebfefd9bae50d8041bf7ce23c137bff | 2026-06-14T10:46:49+10:00 | Refactor Pathfinder state and command handling | Local Review Loop support: state and command handling refactor supporting the review-loop split |
| 917cffd1e99db737a2d07029e99ecf9d7d94a60d | 2026-06-13T21:41:31+10:00 | Intake UI ideation | Idea 01 Workstream Intake UI; Idea 02 Agent Assisted Slice Planning; Idea 03 Workstream Dependency Tree; Idea 04 Parallel Agent Session Launcher; Idea 05 Session Monitoring And Review Loop; Idea 06 PR Handoff And Rich Copy |
| d370b609cfc8fa998147160cdab3a57a4c41ba25 | 2026-06-13T21:16:32+10:00 | Document agent-next slices and integration order | 26 Slice 26: Agent Next State Machine; 27 Slice 27: Agent Prompt Rendering; 28 Slice 28: Agent Bootstrap Instructions; 29 Slice 29: Native Agent Command Wrappers; 30 Slice 30: Agent Integration Doctor |
| 35093c7e36300bc0f045d345e6badab683e9bbd7 | 2026-06-13T20:46:34+10:00 | Expand PR markdown with review loop details | 25 Slice 25: PR Composer Review Loop |
| 49720f0f838c2a4012bb17a768e88d001e038956 | 2026-06-13T20:36:00+10:00 | Add review refresh for stale comment anchors | 24 Slice 24: Review Refresh And Stale Comments |
| 72ae591fbb21ed73421bfeed908f48e4192fe385 | 2026-06-13T20:17:54+10:00 | Add inline commenting controls to diff viewer | 23 Slice 23: Inline Commenting UI |
| 0bd265d32d27dc64223b0429feb70845164c1e10 | 2026-06-13T20:06:01+10:00 | Add read-only diff viewer UI | 22 Slice 22: Read-Only Diff Viewer UI |
| 786241d4a7a81f03d2a42cb9e2edb344a0045c7a | 2026-06-13T19:52:46+10:00 | Add local review server | 21 Slice 21: Local Review Server |
| d2ac06e718eff58908c3430c242ab36b6b0345e4 | 2026-06-13T19:44:56+10:00 | Add feedback queue export command | 20 Slice 20: Feedback Queue Export |
| 5d2b35cc4409f01bcf2d393e544d0ca6f204192f | 2026-06-13T19:35:14+10:00 | Add inline comment anchors | 19 Slice 19: Inline Comment Anchors |
| 92c8395f7d8a3c628488aa7e63c4611d0b1a5e3e | 2026-06-13T16:03:33+10:00 | Add structured diff show command | 18 Slice 18: Structured Diff Model |
| 071e13ca0afc85ebdfcc8444090cc7eb080ad867 | 2026-06-13T15:54:49+10:00 | Remove obsolete code paths | Local Review Loop support: architecture cleanup before structured diff/review UI work |
| 404317f83abe6f7a4449e11206844b6edde08ca3 | 2026-06-13T15:31:26+10:00 | Add durable review session state and CLI commands | 17 Slice 17: Review Session State |
| 2935e6a6788f0fd314acabc2df8ce2b855cd910c | 2026-06-13T15:21:37+10:00 | Add stage plan import command | 16 Slice 16: Stage Plan Import |
| a4bbcf17294d858fd6fac02ec4b478a3356e4d9b | 2026-06-13T15:13:32+10:00 | Restrict deterministic reviews to active slice comments | 14 Slice 14: Deterministic Review Checks |
| a2f2deb8300137685660fb72ac88df89d8266ecc | 2026-06-13T15:07:55+10:00 | Plan local diff review roadmap | 16 Slice 16: Stage Plan Import; 17 Slice 17: Review Session State; 18 Slice 18: Structured Diff Model; 19 Slice 19: Inline Comment Anchors; 20 Slice 20: Feedback Queue Export; 21 Slice 21: Local Review Server; 22 Slice 22: Read-Only Diff Viewer UI; 23 Slice 23: Inline Commenting UI; 24 Slice 24: Review Refresh And Stale Comments; 25 Slice 25: PR Composer Review Loop; Generic Agent Session Prompt; Plan Stages Workflow Template; Implement Stage Workflow Template |
| 98a56e162f08c9d31c06b3ca00e03d95f4798d3d | 2026-06-13T15:07:13+10:00 | Implement PR composer v2 | 15 Slice 15: PR Composer V2 |
| e4b142b491bd32f8541ac448c899a18eac00bdcc | 2026-06-13T13:56:51+10:00 | Add deterministic review checks | 14 Slice 14: Deterministic Review Checks |
| 651e2564742939bc1e5249c768dee811265ffd31 | 2026-06-13T13:41:40+10:00 | Add repository summary git command | 13 Slice 13: Repository Intelligence Summary |
| 5acda8f78e9b446a74bdd193e780c08edaa37ef6 | 2026-06-13T13:30:52+10:00 | Add slice evidence attachments and PR testing output | 12 Slice 12: Evidence Attachments |
| 41e8d4689fce1a35ac725c04979360ae281847e7 | 2026-06-13T13:18:22+10:00 | Add slice dependencies and next selection | 11 Slice 11: Slice Dependencies And Next Selection |
| 88ae021e8c6913210b72b8d0896c315132a1fd79 | 2026-06-13T13:10:17+10:00 | Add requirements context to workstreams | 10 Slice 10: Requirements Context |
| 9b830bd5f46cebec4e0e93e3b297c88f43578ee3 | 2026-06-13T13:02:39+10:00 | Document next MVP slices and priorities | 10 Slice 10: Requirements Context; 11 Slice 11: Slice Dependencies And Next Selection; 12 Slice 12: Evidence Attachments; 13 Slice 13: Repository Intelligence Summary; 14 Slice 14: Deterministic Review Checks; 15 Slice 15: PR Composer V2 |
| ad72fd4d3833d41ff2f27d2ad36734936b461a58 | 2026-06-13T12:57:24+10:00 | Add slice status, branch, and base diff commands | 09 Slice 09: MVP Review Follow-Up |
| 7a1162942b787172c1388bd323ffdbd997d94894 | 2026-06-13T12:46:43+10:00 | Document MVP review slice status | 09 Slice 09: MVP Review Follow-Up |
| 447831b866085cd3b40f6cc74b19a66323c98a24 | 2026-06-13T10:43:33+10:00 | Polish CLI usage errors and add CLI tests | 08 Slice 08: CLI Polish |
| b25b23683e495a7ff673c80a396599467cfc10ee | 2026-06-13T10:37:53+10:00 | Add current context command | 07 Slice 07: Current Context Command |
| d5cefbcc5397ad8554b4fa73f1c34c9d4171cea4 | 2026-06-13T10:33:27+10:00 | Add PR markdown generation command | 06 Slice 06: PR Markdown Generation |
| 78b9fb36993534f25f3cfcc142459ab982ccc0ae | 2026-06-13T10:22:59+10:00 | Add local review record commands and storage | 05 Slice 05: Review State Foundation |
| 437d185f2fcc2c9ebfba78c41b1a206fbdb1974f | 2026-06-13T10:14:18+10:00 | Add git diff command to the CLI | 04 Slice 04: Git Diff Adapter |
| e4f4c2b9f7d742470fde65dc976ff2c0c7ffbbde | 2026-06-13T10:08:52+10:00 | Add local review comments CLI | 03 Slice 03: Comments CLI; Generic Agent Session Prompt |
| 95da7fa2a202d02930f63e2d9e64891b5c128b46 | 2026-06-13T10:03:04+10:00 | Mark repo hygiene slice done and ignore build outputs | 02 Slice 02: Repo Hygiene; Generic Agent Session Prompt |
| 561237fe81286e02c0ba432653b34137276d373d | 2026-06-13T09:59:41+10:00 | Add slice docs | 01 Slice 01: Stage 1 Foundation; 02 Slice 02: Repo Hygiene; 03 Slice 03: Comments CLI; 04 Slice 04: Git Diff Adapter; 05 Slice 05: Review State Foundation; 06 Slice 06: PR Markdown Generation; 07 Slice 07: Current Context Command; 08 Slice 08: CLI Polish |
| aaffa78428cdb214177306dac1604459cc3852b0 | 2026-06-13T09:51:28+10:00 | Add pathfinder CLI bin entry | 01 Slice 01: Stage 1 Foundation |
| ddfe85c459dc57f678a2148f4caf8cf85a034125 | 2026-06-13T09:42:19+10:00 | Initial commit | 01 Slice 01: Stage 1 Foundation |
