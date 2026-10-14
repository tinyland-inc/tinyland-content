# Changelog

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
