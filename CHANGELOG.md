# Changelog

## 1.2.0 — 2026-10-15

Minor release on the 1.x line that folds the retired
`tummycrypt_tinyland_video_thumbnails` module into this package (RU2, RU7).
The RU1/RU13 stack is unchanged from 1.0.0 (TypeScript 7.0.2, vite 8.3.3,
vitest 5.0.3, all exact), and 1.0.0 is the RU10 major for that stack change,
so this is a minor. Bazel module `tummycrypt_tinyland_content` stays the only
distribution path (RU6); the package is `private` and not published (RU8).

Added

- Video thumbnail resolver for YouTube, PeerTube and Vimeo with an in-memory
  cache, merged from the retired `tummycrypt_tinyland_video_thumbnails`
  module (`@tummycrypt/tinyland-video-thumbnails` 0.2.2, registry entries
  0.2.2 and 0.2.3 both built from the v0.2.2 tag, repo
  `xoxd-ai/tinyland-video-thumbnails`, archived). Sources are
  byte-identical to the v0.2.2 tag and to the tinyland.dev monorepo copy,
  except the `detectPlatform` host check below; the tests only change their
  import paths and add the lookalike-host cases. The sources type-check
  under TypeScript 7.0.2.
  - New subpath export `@tummycrypt/tinyland-content/video-thumbnails` with
    the original API: `getVideoThumbnail`, `detectPlatform`,
    `extractYouTubeId`, `fetchYouTubeThumbnail`, `fetchPeerTubeThumbnail`,
    `fetchVimeoThumbnail`, `clearThumbnailCache`, `getCacheStats`,
    `pruneExpiredCache`, `CACHE_TTL` and the `ThumbnailResult`,
    `CacheEntry` and `Platform` types.
  - The root facade is unchanged. It already exports a different
    `extractYouTubeId` and the synchronous `getVideoThumbnailUrl` from
    `ContentRelationshipService`, so the resolver is only on the subpath.
- This module never depended on `tummycrypt_tinyland_video_thumbnails`, so
  the build graph is unchanged.

Fixed (security)

- `detectPlatform` matched hosts by substring (`hostname.includes`), so a
  lookalike host such as `youtube.com.example.net`, `evil-youtube.com` or
  `notvimeo.com` was classified as YouTube or Vimeo (CodeQL
  `js/incomplete-url-substring-sanitization`). It now requires the exact host
  or a dot-separated subdomain of `youtube.com`, `youtu.be` or `vimeo.com`.
  Real hosts and their subdomains (`www.`, `m.`, `music.`, `player.`) are
  unchanged. A lookalike host now returns `null`, or `peertube` when its path
  is `/videos/watch/` or `/w/`, as for any other host.

Migration (video thumbnail consumers)

- Drop `bazel_dep(name = "tummycrypt_tinyland_video_thumbnails", ...)`, any
  `single_version_override` and its `npm_link_package`, and depend on
  `tummycrypt_tinyland_content` 1.2.0 or later. Consumers still on the 0.x
  line also take the 1.0.0 stack migration below.
- Replace `from '@tummycrypt/tinyland-video-thumbnails'` with
  `from '@tummycrypt/tinyland-content/video-thumbnails'` (same names).
- Behavior is otherwise unchanged: the cache is per process with a 24 hour TTL,
  YouTube probes maxres, hq, then mq with HEAD requests, PeerTube reads
  `/api/v1/videos/{uuid}` and Vimeo uses oEmbed.

## 1.1.0 — 2026-10-14

Minor release on the 1.x line that folds the retired
`tummycrypt_tinyland_user_resolution` module into this package (RU2, RU7).
The RU1/RU13 stack is unchanged from 1.0.0 (TypeScript 7.0.2, vite 8.3.3,
vitest 5.0.3, all exact), and 1.0.0 is the RU10 major for that stack change,
so this is a minor. Bazel module `tummycrypt_tinyland_content` stays the only
distribution path (RU6); the package is `private` and not published (RU8).

Added

- User resolution, merged from the retired
  `tummycrypt_tinyland_user_resolution` module
  (`@tummycrypt/tinyland-user-resolution` 0.2.3, repo
  `xoxd-ai/tinyland-user-resolution`, archived). Sources are byte-identical
  to the 0.2.3 release (and to the tinyland.dev monorepo copy). The test
  suite is the monorepo copy, which adds the TIN-2788 directory-authority
  cases (a directory record wins over a same-handle profile, an empty
  directory resolves to `null`); only its import path changes.
  - New subpath export `@tummycrypt/tinyland-content/user-resolution` with
    the original API: `configure`, `getConfig`, `resetConfig`, `resolveUser`,
    `userExists`, `getAllUserHandles`, `clearUserResolutionCache`,
    `RESERVED_ROUTES`, `isReservedRoute` and the `AdminUser`, `Profile`,
    `ResolvedUser` and `UserResolutionConfig` types.
  - The root facade keeps the names it already re-exported (`resolveUser`,
    `userExists`, `getAllUserHandlesFromResolution`,
    `clearUserResolutionCache`, `RESERVED_ROUTES`, `isReservedRoute`,
    `configureUserResolution`, `getUserResolutionConfig`,
    `resetUserResolutionConfig` and the `AdminUser`, `ResolvedUser` and
    `UserResolutionConfig` types); they now resolve to the in-package code.
    The user-resolution `Profile` input type is only on the subpath, because
    the root `Profile` is the profile loader's type.

Changed (build graph)

- `bazel_dep(name = "tummycrypt_tinyland_user_resolution")` and its
  `npm_link_package` are removed from `//:tinyland_content`, `//:typecheck`
  and `//:test`. The only in-house dependency left is
  `tummycrypt_tinyland_content_types` 1.0.0.

Migration (user resolution consumers)

- Drop `bazel_dep(name = "tummycrypt_tinyland_user_resolution", ...)`, any
  `single_version_override` and its `npm_link_package`, and depend on
  `tummycrypt_tinyland_content` 1.1.0 or later.
- Replace `from '@tummycrypt/tinyland-user-resolution'` with
  `from '@tummycrypt/tinyland-content/user-resolution'` (same names), or
  import the aliased names from `@tummycrypt/tinyland-content`.
- Configuration state: the subpath and the root facade share one
  configuration and one profile cache. The standalone package does NOT share
  them: a process that calls `configure()` on
  `@tummycrypt/tinyland-user-resolution` no longer configures the content
  facade (before 1.1.0 the facade re-exported the standalone module). Move
  every import in a process to the content subpath or facade in the same
  change.
- Behavior is otherwise unchanged: `configure()` is still required before
  use and the profile cache TTL is still 60 seconds.

## 1.0.0 — 2026-10-14

Major release for the estate stack uplift (RU1, RU5, RU10, RU13). The public
API is unchanged from 0.10.0: every export, subpath and signature is the same.
The build toolchain and the first-party Bazel dependency move, so this is
the RU10 major. Bazel module `tummycrypt_tinyland_content` stays the only
distribution path (RU6); the package is now `private` and is not published to
npm (RU8).

Changed

- TypeScript 7.0.2 (the native compiler) builds and type-checks the package.
  `typescript`, `vite` (8.3.3) and `vitest` (5.0.3) are pinned exactly (RU5).
  `@fast-check/vitest` ^0.5.0, `fast-check` ^4.10.2 and `publint` ^0.3.25
  follow the vitest 5 line.
- `tsconfig.json` sets `lib: ["ES2022"]` and `types: ["node"]`, because
  TypeScript 6 and later no longer load every `@types/*` package by default.
- MODULE.bazel: `aspect_rules_ts` 3.10.1 with the `typescript` extension at
  7.0.2 (replacing the `ext` extension at 5.9.3), and
  `tummycrypt_tinyland_content_types` re-pinned from 0.3.1 to 1.0.0 (its own
  RU1 major; visibility fails closed and `EventContent` has 4 more optional
  fields).
- New `//:typecheck` target (no emit). CI runs it next to `//:pkg`, `//:test`
  and `//:package_artifact_test`.
- `.bazelrc` resolves in-house modules from `xoxd-ai/bazel-registry`, and the
  package metadata points at `xoxd-ai/tinyland-content`.

Migration (all consumers)

- Re-pin `bazel_dep(name = "tummycrypt_tinyland_content", version = "1.0.0")`
  and drop any `single_version_override` that pins an older content version.
  Imports do not change.
- Consumers that still pin `tummycrypt_tinyland_content_types` below 1.0.0
  are raised to 1.0.0 by MVS (same `compatibility_level`). Code that relied on
  absent or unknown visibility being treated as public must now set it
  explicitly.
- Consumers of the retired `tummycrypt_tinyland_activity_feed` module: drop
  that `bazel_dep`, its override and its `npm_link_package`, and replace
  `from '@tummycrypt/tinyland-activity-feed'` with
  `from '@tummycrypt/tinyland-content/activity-feed'` (same names, available
  since 0.5.0). The same applies to the event-loader, product-loader,
  profile-loader, publishing-hooks and scheduled-publishing modules folded in
  0.6.0 to 0.10.0.


## 0.10.0 — 2026-10-14

Minor release that folds the retired `tummycrypt_tinyland_scheduled_publishing`
module into this package (RU2, RU7). Additive for consumers: no existing
export or signature changes, and the framework stack is unchanged
(TypeScript 5.9, Node >= 22), so this is not the RU1 major. Bazel module
`tummycrypt_tinyland_content` is the only distribution path (RU6).

Added

- Scheduled publishing lifecycle and file-backed store, merged from the
  retired `tummycrypt_tinyland_scheduled_publishing` module
  (`@tummycrypt/tinyland-scheduled-publishing` 0.2.2, repo
  `xoxd-ai/tinyland-scheduled-publishing`, archived). The source is
  byte-identical to the 0.2.2 release (and to the tinyland.dev monorepo copy);
  the test suite only changes its import path.
  - New subpath export `@tummycrypt/tinyland-content/scheduled-publishing`
    with the original API: `configure`, `getCurrentConfig`, `resetConfig`,
    `isInitialized`, `initializeScheduledPublishing`,
    `shutdownScheduledPublishing`, `scheduleContent`, `cancelSchedule`,
    `processScheduledItems`, `createFileBasedService` and the `ScheduledItem`,
    `ScheduledPublishingData`, `ScheduledPublishingService`,
    `ScheduledPublishingLogger` and `ScheduledPublishingConfig` types.
  - The root facade does not re-export these names. The root already exports
    a `ScheduledPublishingService` class and a `ScheduledItem` type from
    `./scheduling` with different shapes, so import the merged API from the
    subpath.
  - New tests pin the file-backed store (schedule replace and cancel, due vs
    future items, retry on publish failure, poll timer lifecycle), which the
    0.2.2 suite did not cover.

Migration (scheduled publishing consumers)

- Drop `bazel_dep(name = "tummycrypt_tinyland_scheduled_publishing", ...)`,
  any `single_version_override` and its `npm_link_package`, and depend on
  `tummycrypt_tinyland_content` 0.10.0 or later.
- Replace `from @tummycrypt/tinyland-scheduled-publishing` with
  `from @tummycrypt/tinyland-content/scheduled-publishing` (same names).
- Behavior is unchanged: the store is still
  `data/scheduled-publishing.json` under `process.cwd()`, the poll interval is
  still 60 seconds, and module state (`configure`, `isInitialized`) is still
  per module instance.

## 0.9.0 — 2026-10-14

Minor release that folds the retired `tummycrypt_tinyland_publishing_hooks`
module into this package (RU2, RU7). Additive for consumers: no existing
export or signature changes, and the framework stack is unchanged
(TypeScript 5.9, Node >= 22), so this is not the RU1 major. Bazel module
`tummycrypt_tinyland_content` is the only distribution path (RU6).

Added

- Publishing hooks, merged from the retired
  `tummycrypt_tinyland_publishing_hooks` module
  (`@tummycrypt/tinyland-publishing-hooks` 0.2.2, repo
  `xoxd-ai/tinyland-publishing-hooks`, archived). Sources and tests are
  byte-identical to the 0.2.2 release (and to the tinyland.dev monorepo copy)
  apart from the test import paths.
  - New subpath export `@tummycrypt/tinyland-content/publishing-hooks` with
    the original API: `configurePublishingHooks`, `getPublishingHooksConfig`,
    `resetPublishingHooksConfig`, `onPublishingChange`, `onContentCreate`,
    `onContentUpdate`, `onContentDelete`, `onContentSchedule`,
    `onContentPublish`, `recordContentVersion`, `recordAutoVersion`,
    `recordCreateVersion`, `recordEditVersion`, `recordStatusChangeVersion`
    and the `PublishingHooksConfig`, `PublishingHooksLogger`,
    `PublishingHooksSpan`, `PublishingHooksTracer`,
    `ScheduledPublishingServiceInterface`, `VersionHistoryServiceInterface`,
    `ContentFederationInterface`, `CreateSpanFn`, `ContentType`,
    `UnifiedContentItem`, `PublishingStatus`, `PublishingHookContext` and
    `PublishingHookResult` types.
  - The root facade does not re-export these names, so the existing root
    exports are unchanged. Import them from the subpath.

Migration (publishing hooks consumers)

- Drop `bazel_dep(name = "tummycrypt_tinyland_publishing_hooks", ...)`, any
  `single_version_override` and its `npm_link_package`, and depend on
  `tummycrypt_tinyland_content` 0.9.0 or later.
- Replace `from '@tummycrypt/tinyland-publishing-hooks'` with
  `from '@tummycrypt/tinyland-content/publishing-hooks'` (same names).
- Behavior is unchanged: unconfigured hooks still use no-op tracing, logging,
  scheduling, versioning and federation services and
  `baseUrl: 'http://localhost:5174'`. The optional `@opentelemetry/api` peer
  of the old package was never imported; tracing is still injected through
  `configurePublishingHooks`.

## 0.8.0 — 2026-10-10

Minor release that folds the retired `tummycrypt_tinyland_profile_loader`
module into this package (RU2, RU7). Additive for consumers: no existing
export or signature changes, and the framework stack is unchanged
(TypeScript 5.9, Node >= 22), so this is not the RU1 major. Bazel module
`tummycrypt_tinyland_content` is the only distribution path (RU6).

Added

- Profile loader, merged from the retired `tummycrypt_tinyland_profile_loader`
  module (`@tummycrypt/tinyland-profile-loader` 0.2.3, repo
  `xoxd-ai/tinyland-profile-loader`, archived). Sources and tests are
  byte-identical to the 0.2.3 release (and to the tinyland.dev monorepo copy)
  apart from the test import paths.
  - New subpath export `@tummycrypt/tinyland-content/profile-loader` with the
    original API: `configure`, `getConfig`, `resetConfig`,
    `loadProfilesServer`, `getPublishedProfilesServer`,
    `getFeaturedProfilesServer`, `getProfileBySlugServer`,
    `getProfilesByRoleServer`, `getProfilesByTagServer`, `getAllRolesServer`,
    `getAllProfileTagsServer`, `searchProfilesServer`,
    `getRandomProfilesServer` and the `Profile`, `ProfileFrontmatter` and
    `ProfileLoaderConfig` types.
  - The root facade keeps the names it already re-exported
    (`configureProfileLoader`, `getProfileLoaderConfig`,
    `resetProfileLoaderConfig`, the ten query functions and the three types);
    they now resolve to the in-package code.

Changed (build graph)

- `bazel_dep(name = "tummycrypt_tinyland_profile_loader")` and its
  `npm_link_package` are removed; this module no longer depends on it.

Migration (profile loader consumers)

- Drop `bazel_dep(name = "tummycrypt_tinyland_profile_loader", ...)`, any
  `single_version_override` and its `npm_link_package`, and depend on
  `tummycrypt_tinyland_content` 0.8.0 or later.
- Replace `from '@tummycrypt/tinyland-profile-loader'` with
  `from '@tummycrypt/tinyland-content/profile-loader'` (same names), or import
  the aliased names from `@tummycrypt/tinyland-content`.
- Behavior is unchanged: the default config is still `baseDir: process.cwd()`
  and `contentSubPath: 'src/content/profiles'`, and the subpath and the facade
  share one configuration.

## 0.7.0 — 2026-10-10

Minor release that folds the retired `tummycrypt_tinyland_product_loader`
module into this package (RU2, RU7). Additive for consumers: no existing
export or signature changes, and the framework stack is unchanged
(TypeScript 5.9, Node >= 22), so this is not the RU1 major. Bazel module
`tummycrypt_tinyland_content` is the only distribution path (RU6).

Added

- Product loader, merged from the retired `tummycrypt_tinyland_product_loader`
  module (`@tummycrypt/tinyland-product-loader` 0.2.3, repo
  `xoxd-ai/tinyland-product-loader`, archived). The code is identical to the
  0.2.3 release; the sources carry the documented copy from the tinyland.dev
  monorepo (comments only differ), and the test file only changes its import
  paths.
  - New subpath export `@tummycrypt/tinyland-content/product-loader` with the
    original API: `configure`, `getConfig`, `resetConfig`,
    `loadProductsServer`, `getPublishedProductsServer`,
    `getFeaturedProductsServer`, `getProductBySlugServer`,
    `getProductsByCategoryServer`, `getAllCategoriesServer`,
    `getAllProductTagsServer`, `searchProductsServer`,
    `getRelatedProductsServer` and the `Product`, `ProductFrontmatter`,
    `ProductLoaderConfig`, `AuthorReference` and `LoadedContent` types.
  - The root facade keeps the names it already re-exported
    (`configureProductLoader`, `getProductLoaderConfig`,
    `resetProductLoaderConfig`, the nine query functions and the `Product`,
    `ProductFrontmatter` and `ProductLoaderConfig` types); they now resolve to
    the in-package code.

Changed (build graph)

- `bazel_dep(name = "tummycrypt_tinyland_product_loader")` and its
  `npm_link_package` are removed; this module no longer depends on it.

Migration (product loader consumers)

- Drop `bazel_dep(name = "tummycrypt_tinyland_product_loader", ...)`, any
  `single_version_override` and its `npm_link_package`, and depend on
  `tummycrypt_tinyland_content` 0.7.0 or later.
- Replace `from @tummycrypt/tinyland-product-loader` with
  `from @tummycrypt/tinyland-content/product-loader` (same names), or import
  the aliased names from `@tummycrypt/tinyland-content`.
- `configure({ loadContent })` must still be called before the loader
  functions; the subpath and the facade share one configuration. The
  unconfigured error text still starts with `tinyland-product-loader:`.

## 0.6.0 — 2026-10-09

Minor release that folds the retired `tummycrypt_tinyland_event_loader`
module into this package (RU2, RU7). Additive for consumers: no existing
export or signature changes, and the framework stack is unchanged
(TypeScript 5.9, Node >= 22), so this is not the RU1 major. Bazel module
`tummycrypt_tinyland_content` is the only distribution path (RU6).

Added

- Event loader, merged from the retired `tummycrypt_tinyland_event_loader`
  module (`@tummycrypt/tinyland-event-loader` 0.2.3, repo
  `xoxd-ai/tinyland-event-loader`, archived). Sources and tests are
  byte-identical apart from the test import paths.
  - New subpath export `@tummycrypt/tinyland-content/event-loader` with the
    original API: `configure`, `getConfig`, `resetConfig`, `loadEventsServer`,
    `getUpcomingEventsServer`, `getPastEventsServer`, `getEventBySlugServer`,
    `getFeaturedEventsServer`, `getRelatedEventsServer`,
    `getEventsByOrganizerServer` and the `EventContent`,
    `EventContentFrontmatter` and `EventLoaderConfig` types.
  - The root facade keeps the names it already re-exported
    (`configureEventLoader`, `getEventLoaderConfig`, `resetEventLoaderConfig`
    and the seven query functions); they now resolve to the in-package code.

Changed (build graph)

- `bazel_dep(name = "tummycrypt_tinyland_event_loader")` and its
  `npm_link_package` are removed; this module no longer depends on it.

Migration (event loader consumers)

- Drop `bazel_dep(name = "tummycrypt_tinyland_event_loader", ...)`, any
  `single_version_override` and its `npm_link_package`, and depend on
  `tummycrypt_tinyland_content` 0.6.0 or later.
- Replace `from '@tummycrypt/tinyland-event-loader'` with
  `from '@tummycrypt/tinyland-content/event-loader'` (same names), or import
  the aliased names from `@tummycrypt/tinyland-content`.
- `configure()` must still be called before the loader functions; the
  subpath and the facade share one configuration.

## 0.5.0 — 2026-10-08

Minor release that folds the retired `tummycrypt_tinyland_activity_feed`
module into this package (RU2, RU7). Additive only: no existing export or
signature changes, and the framework stack is unchanged (TypeScript 5.9,
Node >= 22), so this is not the RU1 major. Bazel module
`tummycrypt_tinyland_content` is the only distribution path (RU6).

Added

- Activity feed, merged from the retired `tummycrypt_tinyland_activity_feed`
  module (`@tummycrypt/tinyland-activity-feed` 0.2.x, repo
  `xoxd-ai/tinyland-activity-feed`, archived). Code and tests are unchanged.
  - New subpath export `@tummycrypt/tinyland-content/activity-feed` with the
    original API: `configure`, `getConfig`, `resetConfig`,
    `getRecentActivityServer`, `getActivityByTypeServer`,
    `getActivityByCategoryServer`, `getActivityByTagServer`,
    `searchActivityServer` and the `ActivityItem`, `BlogPostItem`,
    `ProfileItem`, `ProductItem` and `ActivityFeedConfig` types.
  - The root facade re-exports the same functions and types, with the config
    helpers aliased as `configureActivityFeed`, `getActivityFeedConfig` and
    `resetActivityFeedConfig`.

Migration (activity feed consumers)

- Drop `bazel_dep(name = "tummycrypt_tinyland_activity_feed", ...)`, its
  `single_version_override` and its `npm_link_package`, and depend on the
  `tummycrypt_tinyland_content` 0.5.0 or later.
- Replace `from '@tummycrypt/tinyland-activity-feed'` with
  `from '@tummycrypt/tinyland-content/activity-feed'` (same names), or import
  the aliased names from `@tummycrypt/tinyland-content`.

## 0.4.0 — 2026-10-08

Minor release that lands the retained owner-scoped candidate (5eb83e9, the
source the Mothership writer was built from) on `main` so `xoxd-ai/tinyland.dev`
can pin a released module instead of a source override (RU11). The framework
stack is unchanged (TypeScript 5.9, Node >= 22); the RU1 stack uplift is a
later, major release. Bazel module `tummycrypt_tinyland_content` is the only
distribution path (RU6); nothing is published to npmjs or GitHub Packages.

The 0.3.3 version below was prepared but never tagged or registered; its
changes ship here. Everything it lists is included in 0.4.0.

Added

- `PostOwner`, `loadOwnedPost`, `updateOwnedPost` and `deleteOwnedPost`, also
  on the `createContentLoader()` factory. Owned operations require matching
  stored stable author identity and the exact owner/slug live Markdown path;
  they never fall back to another owner or bundled content.
- `adoptReviewedOwnedPost` with `ReviewedOwnedPostAdoption` and
  `AdoptedOwnedPost`: proof-bound adoption of a reviewed, id-less retained live
  post into the owner-scoped path. The caller supplies `verifyProof`; the
  source must be a regular file and the write is a complete flushed revision.

Changed (behavior, no signature change)

- User content loading fails closed when a live directory has both
  `<slug>.md` and `<slug>.mdx`: neither is served and an error is logged.
  A live file that cannot be read or parsed still shadows a bundled copy of
  the same slug, so a broken override cannot resurrect an older public
  bundled post. Parse failures log only the file path, not the gray-matter
  error (which can quote private source).
- `null` frontmatter `visibility` is normalized to absent before
  `migrateVisibility`, so it fails closed to `private` the same way in the
  blog loader, the by-slug gate and scheduled publishing.

CI and distribution

- `publish.yml` removed (RU8). `ci.yml` stays as a validation-only caller of
  `js-bazel-package.yml@v3.2.1`: `bazel test //:test`, `bazel build //:pkg`
  and `bazel test //:package_artifact_test`, with npm publication disabled
  and no package-write permission.
- `publishConfig` and `prepublishOnly` removed from `package.json`.
- `//:package_artifact_test` is now a `js_test` that runs locked publint on
  the real `//:pkg` tree (no repack) and checks manifest parity and every
  declared entrypoint. The target name is unchanged.
- `MODULE.bazel.lock` is committed.

Migration

- No consumer change is required: existing exports, signatures and the export
  map are unchanged. Consumers move from 0.2.x or 0.3.x by bumping the
  `bazel_dep` to `0.4.0`. Repos with a `.mdx`/`.md` pair for one slug in the
  same user directory must remove one of them.

## 0.3.3 — prepared, never released

See [candidate compatibility and release notes](docs/releases/content-0.3.3-candidate.md)
for the original scope notes. Superseded by 0.4.0.
