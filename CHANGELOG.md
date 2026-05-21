# Changelog

## [0.2.1](https://github.com/ismailcherri/merge-pro/compare/v0.2.0...v0.2.1) (2026-05-21)


### Bug Fixes

* improve file staging by resolving absolute paths and handling malformed URIs ([8526fd2](https://github.com/ismailcherri/merge-pro/commit/8526fd26c61c7967abe0af6ec8ebe454e673f600))
* produce plain v&lt;version&gt; tags from release-please ([#5](https://github.com/ismailcherri/merge-pro/issues/5)) ([98a593a](https://github.com/ismailcherri/merge-pro/commit/98a593a4facd9aaf4c32ab476534d87da0964441))

## [0.2.0](https://github.com/ismailcherri/merge-pro/compare/merge-pro-v0.1.0...merge-pro-v0.2.0) (2026-05-19)


### Features

* add .prettierignore and eslint configuration files to .vscodeignore ([ad0b58f](https://github.com/ismailcherri/merge-pro/commit/ad0b58f60e85f929b5d5d8c6e5e5bfb380e97319))
* add baseLines to ConflictChunk for three-pane display ([f17abb2](https://github.com/ismailcherri/merge-pro/commit/f17abb2f3e965d8c55d6700e43896f42fcff2985))
* add ChunkBandLayer component and integrate with LineNumberStrip and MagicWandColumn ([e80434e](https://github.com/ismailcherri/merge-pro/commit/e80434eab8a9bf5fc2a71077eca3a1dd6100404a))
* add clickable accept zones to gutter connector ([054d28c](https://github.com/ismailcherri/merge-pro/commit/054d28c59778cf8858dac4180deca8baad331db3))
* add DecisionButtons and LineNumberStrip components; refactor ThreePaneEditor layout ([bade075](https://github.com/ismailcherri/merge-pro/commit/bade075dc02efbd8a853fbc042d50057e765e95d))
* add display document builder with chunk padding ([f0ed1d0](https://github.com/ismailcherri/merge-pro/commit/f0ed1d0ab68bda7445f10cee75b9464b32681d22))
* add icon to MergePro panel in package.json ([8aa375f](https://github.com/ismailcherri/merge-pro/commit/8aa375fca92b88435a1fcea67aa596432c727732))
* add interface screenshot to README ([f31c83f](https://github.com/ismailcherri/merge-pro/commit/f31c83f5291ea4df326e22f63fab809d95affbf0))
* add release automation configuration and update changelog structure ([459203d](https://github.com/ismailcherri/merge-pro/commit/459203d57c926a0ac32cdb83285253360cf56cf3))
* add shared CHUNK_FILL constants for SVG chunk colors ([69d2ca6](https://github.com/ismailcherri/merge-pro/commit/69d2ca666b0d284b1524c738ca8011f38b809a3c))
* add visual markers for empty conflict ranges in ThreePaneEditor ([f3a136f](https://github.com/ismailcherri/merge-pro/commit/f3a136f0a20ff686ab70d8d467b7bc7baba41c02))
* add vite config with panel and editor entry points ([c2bce8d](https://github.com/ismailcherri/merge-pro/commit/c2bce8d881bdbca2ca172f02ad253ca61d48bff8))
* ConflictParser — three-way diff producing typed chunks ([d06fd29](https://github.com/ismailcherri/merge-pro/commit/d06fd29dd61fcd1e1b016d5b6cb957c1087c3194))
* ConflictResolver — applies chunk decisions to produce resolved file ([ac2707c](https://github.com/ismailcherri/merge-pro/commit/ac2707ceab86d1b423882ec239ec0440f068f68c))
* declare mergePro.* color tokens with current defaults ([8e4a642](https://github.com/ismailcherri/merge-pro/commit/8e4a642c2afb6ed0b0705bb55ba0e997b9a974e5))
* EditorPane — Monaco editor instance with decoration support ([4825c50](https://github.com/ismailcherri/merge-pro/commit/4825c50fbd55cc57b90b1569294c0c5ecaf7e635))
* enhance conflict navigation with jump to current conflict functionality ([69e592a](https://github.com/ismailcherri/merge-pro/commit/69e592af6ed7a665d4324cf4c1eecd964dfe4c0d))
* enhance conflict resolution with new chunk handling and single side decision logic ([0122215](https://github.com/ismailcherri/merge-pro/commit/0122215d1175e2a71fb15535db68117011b5e392))
* enhance conflict resolution with per-side decisions and chunk coalescing ([ee0ba58](https://github.com/ismailcherri/merge-pro/commit/ee0ba58992cc8045e79e660f707edcb5bc9fb931))
* enhance merge editor with dynamic CSS loading and improved gutter connector ([64aa7c2](https://github.com/ismailcherri/merge-pro/commit/64aa7c2646494a97992957c32b01e91147ebcacf))
* enhance MergeEditorProvider with active editor tracking and event emission ([ff5462f](https://github.com/ismailcherri/merge-pro/commit/ff5462ff11ff2f4b9969c6d85ab2e2d29e21c3db))
* error handling — unresolved markers warning, load failure fallback ([0490225](https://github.com/ismailcherri/merge-pro/commit/04902253ecb77f1c6b4d3354cee3f77ecc2fdda0))
* extension entry point — wires Sprint 1 services ([2d70090](https://github.com/ismailcherri/merge-pro/commit/2d7009009b5ece46c95e716bd536fc14ec4c0049))
* GitService — wraps vscode.git extension API ([4e733d1](https://github.com/ismailcherri/merge-pro/commit/4e733d16fb7d8ef338f5e0f8bc26204d41258884))
* GutterConnector — SVG polygon connectors between editor panes ([bd5de6c](https://github.com/ismailcherri/merge-pro/commit/bd5de6c20ad9faa9cc542879ce2c31f33e97becc))
* implement file staging and conflict warning in MergeEditorProvider ([74e7a6c](https://github.com/ismailcherri/merge-pro/commit/74e7a6c84c4d331b483383dd489ce5f2b6b91425))
* implement inline character-level diff highlighting and add tests ([cf44f04](https://github.com/ismailcherri/merge-pro/commit/cf44f04bb62d636ea7c2256b1fb5513566085b09))
* implement magic resolve functionality for conflict chunks; add MagicWandColumn component and related tests ([d27629e](https://github.com/ismailcherri/merge-pro/commit/d27629e26cbe8b699faf00dfebfa8877b306e596))
* implement undo/redo functionality and enhance editor state management ([1fda4ae](https://github.com/ismailcherri/merge-pro/commit/1fda4aef582ee5dc5e5412f93cff4eb9557184c2))
* implement unsaved changes warning and track dirty state in MergeEditorProvider ([a90626a](https://github.com/ismailcherri/merge-pro/commit/a90626a7877d22ebb107173e153927091897482d))
* integrate DecisionButtons into GutterConnector tests; enhance button rendering logic ([21adae1](https://github.com/ismailcherri/merge-pro/commit/21adae1e3acdcb8953e77f35afe589c942fbe7ee))
* MergeEditorProvider — three-pane editor webview panel ([0ef2df3](https://github.com/ismailcherri/merge-pro/commit/0ef2df3502dca8f938020ed7d22ee33c5b1a8f54))
* MergePanelProvider — SCM sidebar panel wired to session state ([e50e7c6](https://github.com/ismailcherri/merge-pro/commit/e50e7c6af47227d88847bc3ec75871393286c4df))
* MergeSessionManager — session state with chunk tracking ([c015fde](https://github.com/ismailcherri/merge-pro/commit/c015fde03072b88a192f31111f766fa1c7c70f08))
* panel React components — SessionHeader, FileList, BatchActionsBar ([d58c375](https://github.com/ismailcherri/merge-pro/commit/d58c375d0278cbc6fe11791dbc92139121f8a25e))
* rewrite ThreePaneEditor with padded three-pane layout and result panel ([4ab3062](https://github.com/ismailcherri/merge-pro/commit/4ab30623c59001291a52cf7c248fb3b7013c21da))
* shared types and message protocol ([b1bf15e](https://github.com/ismailcherri/merge-pro/commit/b1bf15e967b7c5feb5872279afc0ed38f4b82a49))
* synchronize horizontal scrolling between editor panes in ThreePaneEditor ([a973cdf](https://github.com/ismailcherri/merge-pro/commit/a973cdf9ed3cbb9c3c00822d420e3b24d62937cd))
* three-pane editor — Monaco panes, SVG connectors, toolbar ([d825da4](https://github.com/ismailcherri/merge-pro/commit/d825da42825e56c83ffd3d0d2fd239bd9c7337fd))
* update build scripts and add esbuild for improved performance ([346cb56](https://github.com/ismailcherri/merge-pro/commit/346cb56504234681dfadca7cbdaa2b3dff013224))
* update README with interface images and instructions ([7b949b9](https://github.com/ismailcherri/merge-pro/commit/7b949b98c7cc803c8f2d4b7e124c8de14a7bc9d5))
* use mergePro color tokens for chunk backgrounds in panes ([d8c52a0](https://github.com/ismailcherri/merge-pro/commit/d8c52a07a0ad5623c6e467803b798a1d9fc0678a))
* use mergePro color tokens for chunk-band layer fills ([1021d06](https://github.com/ismailcherri/merge-pro/commit/1021d06527b87df34d4f9425440f09f8e95a0ac3))
* use mergePro color tokens for gutter connector fills ([9b445c3](https://github.com/ismailcherri/merge-pro/commit/9b445c3c605453e83f9a90844f3a01e00f3f8131))
* wire batch accept and auto-resolve commands ([70f4bd3](https://github.com/ismailcherri/merge-pro/commit/70f4bd3579592f071238677d07dbf28fb6e18882))


### Bug Fixes

* add pane IDs, fix Monaco worker loading, use json language worker ([b720504](https://github.com/ismailcherri/merge-pro/commit/b72050408206f7a3aab79ee7f3e985b61093d395))
* add scroll guard and editor mount callback for gutter positioning ([482d0ed](https://github.com/ismailcherri/merge-pro/commit/482d0ed2dd24d265d6144c380e7b7729aa2b4f01))
* ConflictParser — identical-change false conflict, trailing newline spurious chunk ([19060d8](https://github.com/ismailcherri/merge-pro/commit/19060d8baeec740a9c79ce8b4a3ece8e2e94415c))
* EditorPane — dispose scroll listener, sync language/readOnly changes ([4ee6eae](https://github.com/ismailcherri/merge-pro/commit/4ee6eae1dc5d9030db63f4b7ccb0a71eb8acb294))
* enhance editor functionality with improved display ranges and scrollbar visibility ([fb2a114](https://github.com/ismailcherri/merge-pro/commit/fb2a1142f9b01c764a2ab9daf9a5ed8dc0b21b0a))
* error handling — remove fragile setTimeout, tighten conflict marker regex, log ErrorBoundary ([a8f6e79](https://github.com/ismailcherri/merge-pro/commit/a8f6e79d3d8f76070e50eca3d15e09cef664ff59))
* GitService — repo disposable map, init guard, activation error handling ([10f98aa](https://github.com/ismailcherri/merge-pro/commit/10f98aa7e0b6085b91db8a34d70a077242143198))
* GutterConnector — stable polygon keys, remove spurious height dep ([97eaa5a](https://github.com/ismailcherri/merge-pro/commit/97eaa5a01d09b6786ce9c38b07fb78213b9b87dc))
* improve editor layout and gutter connector styling for better visibility ([1211902](https://github.com/ismailcherri/merge-pro/commit/12119028f034520733d6d8b77a294aca8b9f36a9))
* integration tests — correct fully-qualified extension ID ([6ab3a90](https://github.com/ismailcherri/merge-pro/commit/6ab3a90edcda8dc8a05b562942bede56aea9460d))
* MergeEditorProvider — track disposables, error handling, secure nonce ([34973ee](https://github.com/ismailcherri/merge-pro/commit/34973ee91db8bd682b872df3bd047c08d58823c6))
* non-conflicting chunk winner tracking for correct auto-resolve ([90c5370](https://github.com/ismailcherri/merge-pro/commit/90c5370b3eec5e759c1bad6ad0ee9456c83aee3c))
* panel components — deduplicate types, type protocol, add App/BatchActionsBar tests ([76cea7c](https://github.com/ismailcherri/merge-pro/commit/76cea7cb9008ed0948fd5b7af961c740fc2cab2f))
* pin vite to ^7 for plugin-react peer compatibility ([f8f0a4e](https://github.com/ismailcherri/merge-pro/commit/f8f0a4e49a7ddf00741703e3f5df7e5b59b08171))
* ThreePaneEditor — center pane ref, autoResolve index, guard batch accept ([0bf34b1](https://github.com/ismailcherri/merge-pro/commit/0bf34b10457471f5ab169cae656d06ed91b7ae85))
* ThreePaneEditor autoResolve — respect chunk.winner and skip resolved chunks ([8255b57](https://github.com/ismailcherri/merge-pro/commit/8255b57a00d056afd672211f92fbc94d7c9d1bd9))
* update editor configuration and resolve chunk handling for result document ([d67b3c4](https://github.com/ismailcherri/merge-pro/commit/d67b3c4ed41a8322d70472af75963b56f0cba71c))
* use crypto-secure nonce and complete CSP in panel webview ([96bb15d](https://github.com/ismailcherri/merge-pro/commit/96bb15d0856c26805f77a53c530fa8a26d193427))
* use explicit calc() widths for three-pane layout to prevent overlap ([a10b332](https://github.com/ismailcherri/merge-pro/commit/a10b332b786de4ab4c122904f82a924c82de4822))
* use script type=module for Vite ES module output in webview ([9343099](https://github.com/ismailcherri/merge-pro/commit/9343099e4f8acac7b6eebf3978bb0f344ad154aa))


### Documentation

* add AGENTS.md for AI contributor guidance ([447a13c](https://github.com/ismailcherri/merge-pro/commit/447a13c3b5ee38c6534dd573492ad65920c83f73))
* add CONTRIBUTING guide ([0a02fc9](https://github.com/ismailcherri/merge-pro/commit/0a02fc9f85f402ded14aca8d8f17e7eb46b1dbaf))
* add Contributor Covenant 2.1 ([9e924e8](https://github.com/ismailcherri/merge-pro/commit/9e924e81a112477f1f6e3bd2a823e50a7878edb4))
* add design spec for customizable merge state colors ([e9316d1](https://github.com/ismailcherri/merge-pro/commit/e9316d11a977d296c207262bd567a58366acbc6f))
* add implementation plan for customizable merge state colors ([0f97869](https://github.com/ismailcherri/merge-pro/commit/0f97869990cf85cc98bedf7d6ae74af6ebec5f9d))
* add implementation plan for inline character-level diff highlighting ([013d1b2](https://github.com/ismailcherri/merge-pro/commit/013d1b2a31c787543721c6d63075bae8f6e9bf83))
* add inline character-level diff highlighting design spec ([cfe2e93](https://github.com/ismailcherri/merge-pro/commit/cfe2e93e7c84eb88e21a92985b8780f0583e8e61))
* add v0.1 release prep design spec ([be81395](https://github.com/ismailcherri/merge-pro/commit/be81395e53ef9c64ba92af0b061bfccbc27215cc))
* add v0.1 release prep implementation plan ([793c3f5](https://github.com/ismailcherri/merge-pro/commit/793c3f5d8ec209b6424cfed438217685ac1af91e))
* document mergePro color customization tokens ([0d0e7ed](https://github.com/ismailcherri/merge-pro/commit/0d0e7ed19f6575b6b319a9b9829f4214edbd23ff))
* IntelliJ merge editor implementation plan ([11938b5](https://github.com/ismailcherri/merge-pro/commit/11938b55b439acb33efeac86c40c46df54b7d19e))
* IntelliJ-style three-pane merge editor spec ([4e40607](https://github.com/ismailcherri/merge-pro/commit/4e40607ab5b88393bc1a55bcb5e64acf5cec051d))
* reformat CHANGELOG to Keep-a-Changelog ([2729b78](https://github.com/ismailcherri/merge-pro/commit/2729b7834889f2be0e2cd9e262b8f0618e203cfb))
* rewrite README for v0.1 release ([d7b3968](https://github.com/ismailcherri/merge-pro/commit/d7b3968057ea7252014ec42dc6d64ff4e2629841))
* webpack-to-vite migration implementation plan ([636fa5d](https://github.com/ismailcherri/merge-pro/commit/636fa5d118de09bfe1191da8f04ba24dfc183602))
* webpack-to-vite migration spec ([b31aa42](https://github.com/ismailcherri/merge-pro/commit/b31aa428d01cc3a60207730bb3d2cbcbebcfbe9e))


### Refactors

* MergePanelProvider — extract buildWebviewState, track message disposable ([f2c01d6](https://github.com/ismailcherri/merge-pro/commit/f2c01d6f82aacfad08c503a19ca57b1e5c458c56))
* simplify toolbar, remove bulk accept buttons ([0720be6](https://github.com/ismailcherri/merge-pro/commit/0720be6798bad55bdddbbc6c807f667548e21a44))
* split types — protocol.ts (webview-safe) and types.ts (host-only) ([c2fbff0](https://github.com/ismailcherri/merge-pro/commit/c2fbff09b3daeb98818181d6a6ac5a7e640cd932))

## 0.1.0 (2026-05-18)

Initial public release.

### Features

* Three-pane Monaco merge editor (Current | Result | Incoming) with synchronized scrolling.
* SVG connectors linking corresponding chunks across panes.
* Color language: green (non-conflicting), brown (true conflict), teal (resolved).
* Inline character-level diff highlighting within conflict chunks.
* Batch actions: Accept All Ours, Accept All Theirs, Auto-Resolve Non-Conflicting.
* Magic Resolve column for one-click superset resolutions.
* Decision buttons per chunk with line-number gutter and gutter connectors.
* Conflict navigation: `Alt+Up`, `Alt+Down`.
* Undo/redo of per-file decisions.
* SCM sidebar panel with grouped CONFLICTS / RESOLVED sections, progress bars, and per-file conflict counts.
* Active-editor tracking: the panel highlights the file currently being edited and disables its Resolve button while the editor is open.
* Auto-stage on save: when a file is saved with no remaining conflict markers, MergePro runs `git add` so the file leaves the Source Control panel's "Merge Changes" section.
* Modal warning when saving a file that still contains conflict markers, with a count of unresolved chunks; the file is written but **not** staged in that case.
* Reopen prompt when the merge editor is closed with unsaved decisions, so the user can return and save without losing work.
