# Product Execution Roadmap

## Context

The repo can stay `ytscan` for now.

The product direction is changing from a broad "YouTube AI studio" toward a tighter, more valuable workflow:

`Import founder media or a YouTube archive, transcribe it, translate it, dub it, and keep the whole library searchable in one place.`

This roadmap is intentionally tied to the current codebase and current routes.

---

## 1. Product North Star

### Primary user

- executive assistants
- founder content teams
- agencies/localization operators handling multilingual media

### Primary job

`Take a long-form French video or audio file and turn it into usable English assets fast, while keeping everything searchable and organized.`

### Secondary job

`Import a historical YouTube channel archive and decide which videos are worth localizing.`

---

## 2. What The Product Should Be

### Core pillars

1. `Import`
2. `Transcribe`
3. `Translate`
4. `Dub`
5. `Archive`
6. `Channel history` as a source and prioritization layer

### The product is not

- a general AI creator studio
- a full script-writing suite
- a thumbnail/previs lab
- a team collaboration platform yet

---

## 3. Current State We Should Build On

### Already good enough to keep

- auth and SaaS tenancy
- uploaded media pipeline
- transcription jobs
- transcript archive and detail views
- YouTube channel ingest pipeline
- searchable channel transcript history
- Cloudflare Worker + D1 + R2 + Railway architecture

### Existing capabilities that should be demoted or hidden

- script lab
- persona training
- compare
- hooks
- opportunities
- thumbnails
- previs

These may become internal tools or later-stage features, but they should not drive the main product.

---

## 4. Route Decision Matrix

This is the practical route plan from the current app.

## Keep and polish

### Public routes

- `/`
- `/sign-in`
- `/sign-up`
- `/auth/*`

### Main app routes

- `/app/transcribe`
- `/app/transcribe/[mediaId]`
- `/app/channels`
- `/app/channels/[slug]`
- `/app/channels/[slug]/videos`
- `/app/channels/[slug]/videos/[youtubeId]`
- `/app/channels/[slug]/search`
- `/app/scans/new`
- `/app/scans/[jobId]`
- `/app/settings`
- `/app/settings/account`

## Keep but rename/reframe later

- `/app/channels/[slug]`
  This should become a channel import/archive dashboard, not a strategy playground.

- `/app/channels/[slug]/search`
  This should be framed as archive search across imported channel transcripts.

## Hide from main nav immediately

- `/app/persona`
- `/app/persona/[modelId]`
- `/app/persona/[modelId]/history`
- `/app/settings/persona-models`
- `/app/settings/persona-models/[modelId]`
- `/app/settings/persona-models/[modelId]/history`
- `/app/channels/[slug]/script-lab`
- `/app/channels/[slug]/script-lab/[projectId]`
- `/app/channels/[slug]/script-lab/projects`
- `/app/channels/[slug]/compare`
- `/app/channels/[slug]/compare/picker`
- `/app/channels/[slug]/hooks`
- `/app/channels/[slug]/thumbnails`
- `/app/channels/[slug]/opportunities`
- `/app/settings/billing`
- `/app/settings/billing/limit`
- `/app/settings/members`
- `/app/settings/workspace`

These can stay in code temporarily, but should not be exposed in the primary product.

## New top-level routes to add

### `Archive`

- `/app/archive`
  Unified archive of uploaded and imported media

### `Import`

- `/app/import`
  Unified entrypoint for:
  - upload media
  - import YouTube channel

### `Translation`

- `/app/media/[mediaId]/translation`
  Side-by-side transcript translation review

### `Dub`

- `/app/media/[mediaId]/dub`
  Dub job status, output review, download

### `Localization candidates`

- `/app/channels/[slug]/localize`
  Ranked videos worth translating/dubbing

---

## 5. Recommended Navigation

## Primary nav

- `Archive`
- `Import`
- `Channels`
- `Settings`

## Secondary nav inside media detail

- `Transcript`
- `Translation`
- `Dub`
- `Exports`

## Secondary nav inside a channel

- `Overview`
- `Videos`
- `Search`
- `Localize`

This keeps the information architecture coherent.

---

## 6. Data Model Changes

We should extend the current `uploaded_media` transcription model into a full localization model.

## Existing tables to keep using

- `uploaded_media`
- `uploaded_media_segments`
- `generation_jobs`
- `channels`
- `videos`
- `transcript_chunks`
- `workspaces`
- `workspace_members`

## Schema additions

### 6.1 Extend `uploaded_media`

Add:

- `source_language`
- `target_language`
- `translated_transcript_word_count`
- `translated_segment_count`
- `dubbed_audio_asset_id`
- `dubbed_video_asset_id`
- `translation_status`
- `dubbing_status`
- `source_title`
- `source_description`

### 6.2 Add `uploaded_media_translations`

Purpose: one media file can have multiple translated transcript variants later.

Fields:

- `id`
- `media_id`
- `workspace_id`
- `source_language`
- `target_language`
- `status`
- `provider`
- `translated_text`
- `word_count`
- `segment_count`
- `error_message`
- `created_at`
- `updated_at`

### 6.3 Add `uploaded_media_translation_segments`

Fields:

- `id`
- `translation_id`
- `segment_index`
- `start_time`
- `end_time`
- `text`
- `word_count`

### 6.4 Add `localization_jobs`

We can either:

- reuse `generation_jobs`

or

- add a new `localization_jobs` table

Recommendation:
- reuse `generation_jobs` for now to keep the control plane simple
- standardize `job_type` values:
  - `transcription`
  - `translation`
  - `dub_audio`
  - `dub_video_mux`
  - `channel_scan`

### 6.5 Extend `generated_assets` usage

We already have asset records. Use them more systematically for:

- `transcript_txt`
- `transcript_srt`
- `transcript_vtt`
- `transcript_json`
- `translated_txt`
- `translated_srt`
- `translated_vtt`
- `translated_json`
- `dubbed_audio`
- `dubbed_video`

### 6.6 Add `channel_localization_candidates`

Fields:

- `id`
- `workspace_id`
- `channel_id`
- `video_id`
- `score`
- `why_json`
- `status`
- `created_at`
- `updated_at`

Purpose:
- rank which historical videos are worth translating/localizing

---

## 7. Backend Changes

## 7.1 Keep current backend responsibilities

Cloudflare Worker should remain:

- auth
- tenancy
- job control plane
- D1 metadata API
- R2 signed upload/download handling

## 7.2 Expand the media API

### Existing to keep

- create upload
- get media detail
- trigger transcription
- download source
- download asset

### New endpoints to add

- `POST /api/media/:id/translate`
- `GET /api/media/:id/translation`
- `POST /api/media/:id/dub`
- `GET /api/media/:id/dub`
- `GET /api/archive`
- `POST /api/import/youtube`
- `GET /api/channels/:slug/localize`

## 7.3 Improve worker job orchestration

The Railway worker should become the unified background processor for:

- scan jobs
- transcription jobs
- translation jobs
- dubbing jobs

This is already close to how the app works.

## 7.4 Build vs buy

### Build

- upload pipeline
- transcript storage
- archive
- transcript search
- YouTube import archive
- localization candidate ranking

### Buy

- long-form dubbing
- visible translated talking-head video

### Practical provider split

- transcription: self-hosted `faster-whisper`
- translation: LLM/provider-based text translation
- dubbing: provider API
- visible lip-synced translated video: provider API later

---

## 8. Frontend Changes

## 8.1 Product surface

The app should feel like a focused archive/localization tool.

### Main user journeys

#### A. Upload media

- drop/upload file
- queue transcription
- see progress
- open transcript detail

#### B. Translate transcript

- select target language
- run translation
- review side-by-side segments
- export translated transcript

#### C. Dub content

- generate English dub
- monitor progress
- preview/download dubbed output

#### D. Import channel archive

- paste channel URL
- ingest
- browse historical videos
- search transcript archive
- see top videos worth localizing

## 8.2 UI pages to build or refactor

### Build

- `Archive` index page
- media translation page
- media dub page
- channel localization candidate page
- unified import page

### Refactor

- transcribe archive should become the broader archive
- channel dashboard should emphasize historical archive, not strategy theater
- settings should be reduced to account and internal configuration only

### Remove confusion

- stop exposing half-built AI-studio concepts in the primary interface
- hide features that don’t support the localization/archive workflow

---

## 9. Mission-Critical Reliability Requirements

If this product is going to be used operationally, these are mandatory.

## Uploads

- support long files reliably
- show deterministic progress states
- retry safely

## Jobs

- no phantom loaders
- no blank pages
- no fake success states
- clear failure messages

## Exports

- transcript and translated assets always downloadable
- final dubbed outputs downloadable

## Tenancy

- every user gets a clean personal workspace by default
- no default seed data leakage
- no cross-tenant visibility

## Archive

- searchable
- stable
- never loses state while polling

---

## 10. Phased Build Plan

## Phase 0: Product cleanup

Goal:
- simplify the app surface before adding more capability

Tasks:
- remove hidden/buggy legacy flows from main nav
- reframe shell around archive/import/channels
- clean settings
- keep routing compatible but stop surfacing weak features

## Phase 1: Solidify transcription/archive

Goal:
- make the current transcription pipeline excellent

Tasks:
- finish archive polish
- filtering/sorting in archive
- segment search
- transcript copy/export
- better retry flows
- transcript status history

Outcome:
- a reliable transcript product already worth internal use

## Phase 2: Add translation workflow

Goal:
- let a user turn source transcript into English transcript

Tasks:
- schema additions for translated transcript documents
- translation job creation/status
- translation segment viewer
- side-by-side transcript UI
- export translated TXT/SRT/VTT/JSON

Outcome:
- useful localization product even before dubbing

## Phase 3: Add dubbed output

Goal:
- produce downloadable English audio and English MP4

Tasks:
- dub job orchestration
- provider integration
- output asset storage
- dub detail page
- preview/download

Outcome:
- first meaningful paid localization workflow

## Phase 4: Reframe channel import

Goal:
- turn YouTube ingest into a valuable secondary source

Tasks:
- import historical channels
- keep dashboard/video archive/search
- rank videos worth translating/localizing
- link candidate videos into localization workflows

Outcome:
- the old YTScan advantage becomes a real moat layer

## Phase 5: External paid readiness

Goal:
- make the product ready for external customers

Tasks:
- observability
- quotas
- pricing/usage controls
- invite flow if needed
- email templates and notifications
- support/documentation

---

## 11. What To Build Next

The next build priority should be:

1. hide/de-emphasize the legacy AI-studio surface
2. introduce a unified `Archive` and `Import` information architecture
3. build transcript translation end to end
4. then add dubbed output
5. then reframe channel ingest as a localization input source

That is the shortest path to a product users will actually pay for.
