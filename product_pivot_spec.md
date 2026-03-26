# Product Pivot Spec

## Working Title

`YTScan` can remain the repo/product name for now, but the product should be repositioned away from "YouTube analytics" toward:

`A multilingual content archive and localization tool for founder teams.`

Possible user-facing naming directions later:

- `YTScan Localize`
- `FounderDub`
- `Archive to English`
- `Multilingual Content Ops`

## Problem

The original product direction tried to do too many things:

- channel ingest
- analytics
- semantic search
- competitor research
- script generation
- thumbnails
- previs
- persona training

That created infrastructure, but not a sharp user outcome.

The clearer recurring problem is:

1. founder teams and executive assistants handle long-form media constantly
2. they need transcripts, translations, and English versions quickly
3. they need a searchable archive of source and translated content
4. they sometimes also need historical YouTube channel ingest to decide what content is worth localizing

## Who This Product Is For

### Primary customer

- Executive assistants to founders / entrepreneurs
- Small founder content teams
- Agencies handling multilingual founder media
- In-house ops/content teams that repurpose long-form video

### Not the first customer

- broad solo creators looking for generic AI tooling
- hobbyists
- large enterprise media localization teams with complex compliance workflows

## Jobs To Be Done

### Core job

`When I receive a French video or audio file, help me turn it into usable English content fast without juggling five separate tools.`

### Supporting jobs

- Upload a long file and get a timestamped transcript
- Translate that transcript into English
- Generate an English dub in the original speaker's style
- Download a final English audio file or muxed English MP4
- Keep a searchable archive of all source and translated assets
- Import historical YouTube channel data and identify which videos are worth localizing

## Product Principles

1. **One concrete outcome per workflow**
   Upload -> transcript -> translation -> dub -> export.
2. **Archive first**
   Every asset becomes searchable and reusable.
3. **Human review where it matters**
   Translation and dubbing should be reviewable/editable before export.
4. **Long-form reliability over flashy AI**
   90-minute files that finish correctly are more valuable than brittle "creative" features.
5. **Keep YouTube ingest as a source, not the whole product**
   Historical YouTube data should feed archive and prioritization.

## V1

### V1 headline

`Upload or import long-form media, get accurate transcripts, English translations, dubbed English output, and a searchable archive.`

### V1 features

#### 1. Media ingest

- upload video/audio files
- create media record
- private storage in R2
- long-running processing on Railway

#### 2. Transcription

- Whisper/faster-whisper transcription
- timestamped transcript segments
- TXT / SRT / VTT / JSON export
- transcript detail viewer
- transcript search within a single file

#### 3. Translation

- source transcript -> English transcript
- side-by-side transcript view
- downloadable translated SRT / VTT / TXT / JSON
- basic retry flow
- language metadata on each asset

#### 4. Dubbed output

- generate English audio in target voice
- optionally mux English audio onto original MP4
- downloadable final files
- job progress + retries

#### 5. Archive

- list all uploaded/imported media
- filter by status / language / source type
- open transcript detail
- open translated detail
- export assets

#### 6. YouTube ingest as import source

- paste channel URL
- import historical channel archive
- searchable transcript/history dashboard
- basic recommendation: "top videos worth localizing"

### V1 non-goals

- full AI script studio
- previs
- full thumbnail generation suite
- lip-synced translated talking-head video
- billing/payments
- team invite system
- advanced approvals

## V2

### V2 features

- translated talking-head video output via partner/provider API
- reusable terminology glossary
- reviewer comments / approval states
- batch localization
- "best videos to localize next" scoring using historical YouTube performance
- Drive/Dropbox import
- webhook/API ingestion
- basic role separation for assistants vs owners

## What To Keep From The Current App

### Keep

- auth
- per-user tenancy
- Cloudflare Worker API
- D1
- R2 storage
- Railway workers
- upload/transcription pipeline
- transcript archive UX
- YouTube ingest pipeline
- channel dashboard/search as an import-analysis surface

### Keep but demote

- persona training
- script lab
- compare
- opportunities

These should not drive the product story right now. Hide or mark as internal until they clearly support the localization workflow.

### Cut or hide from primary nav

- persona as a top-level navigation item
- script lab as a primary product path
- billing placeholders
- anything that implies a broader "AI creator studio"

## Information Architecture

### Primary nav

- `Archive`
- `Import`
- `Transcripts`
- `Translations`
- `Dubs`
- `Channels`
- `Settings`

### Route model

- `/app/archive`
- `/app/import`
- `/app/media/[mediaId]`
- `/app/media/[mediaId]/transcript`
- `/app/media/[mediaId]/translation`
- `/app/media/[mediaId]/dub`
- `/app/channels`
- `/app/channels/[slug]`

### Channel area

Treat YouTube channels as one import source among others.

Inside a channel:

- overview dashboard
- all videos archive
- transcript search
- "worth localizing" shortlist

## User Flows

### Flow A: Upload and transcribe

1. user uploads a file
2. media record created
3. worker processes transcript
4. transcript detail page becomes available
5. user searches/copies/exports transcript

### Flow B: Upload, translate, dub

1. transcript completes
2. user selects target language = English
3. translation job runs
4. user reviews translated transcript
5. user starts dub
6. dub job completes
7. user downloads audio or English MP4

### Flow C: Import channel and prioritize localization

1. user pastes YouTube channel URL
2. app ingests metadata + transcripts
3. dashboard shows historical archive
4. app surfaces top-performing videos and transcript search
5. app recommends which assets are worth translating/localizing

## Architecture

### Existing stack that still fits

- **Vercel / Next.js**: app UI
- **Cloudflare Worker**: auth + API + job control plane
- **D1**: relational metadata
- **R2**: raw uploads and generated artifacts
- **Railway worker**: heavy file processing

### Recommended service split

#### Build in-house

- upload handling
- transcript storage
- transcript translation orchestration
- archive/search
- job status
- export/download
- YouTube ingest/archive

#### Use providers

- **Transcription**: self-hosted `faster-whisper`
- **Translation**: LLM/provider-backed text translation with reviewability
- **Dubbed audio**: provider-backed long-form dubbing
- **Lip-synced translated video**: provider-backed only, later

### Recommended provider strategy

#### V1

- transcription: `faster-whisper` on Railway
- translation: provider API or high-quality LLM text workflow
- dubbed audio/video: ElevenLabs Dubbing or equivalent long-form dubbing provider

#### V2

- talking-head visible translated video: HeyGen/Rask-class provider

## Data Model Additions

### Current uploaded media tables should evolve toward:

#### `uploaded_media`

- id
- workspace_id
- created_by_user_id
- source_type (`upload`, `youtube_import`)
- file_name
- mime_type
- duration_sec
- file_size_bytes
- source_language
- target_language
- status
- r2_key
- created_at

#### `transcript_documents`

- id
- media_id
- language
- transcript_text
- transcript_asset_ids
- status
- created_at

#### `transcript_segments`

- id
- media_id
- transcript_document_id
- language
- segment_index
- start_time
- end_time
- text
- word_count

#### `localization_jobs`

- id
- workspace_id
- media_id
- job_type (`transcribe`, `translate`, `dub`, `mux_video`)
- provider
- status
- stage
- progress
- input_json
- output_json
- error_message
- created_at
- updated_at

#### `localized_assets`

- id
- media_id
- kind (`transcript_txt`, `transcript_srt`, `translated_srt`, `dubbed_audio`, `english_video`)
- language
- r2_key
- mime_type
- file_size_bytes
- created_at

#### `channel_localization_candidates`

- id
- channel_id
- video_id
- score
- reasons_json
- created_at

## What Makes This Worth Paying For

The product should not sell "AI." It should sell:

- time saved
- workflow consolidation
- archive/searchability
- reliable multilingual output

### Paid value proposition

`Replace a messy manual localization workflow with one searchable system that ingests founder media, produces transcripts and English outputs, and keeps everything organized.`

## Pricing Hypothesis

### Internal / early design partner phase

- no public billing
- hand-managed onboarding
- usage monitoring only

### First real paid motion

Not a cheap self-serve creator plan.

Target:

- small teams
- agencies
- founder offices

Pricing shape:

- subscription + usage cap
- base monthly platform fee
- included processing minutes
- overage or premium jobs for dubbing / translated video

Rough product logic:

- transcript-only tier
- localization tier
- premium dubbed-video tier

## Mission-Critical Production Criteria

To call this production-ready for internal and early paid customers:

1. uploads work reliably for 90-minute files
2. transcription retries are solid
3. translation jobs are reviewable
4. dub jobs succeed and produce downloadable output
5. archive pages never blank/flicker unpredictably
6. per-user tenancy is correct
7. exports are stable
8. job status is trustworthy

## Immediate Build Sequence

### Phase 1: Tighten the current transcription/archive product

- make archive UX extremely solid
- add translation pipeline
- add transcript translation detail page
- add translated export assets

### Phase 2: Add dubbed output

- start dub job from translated transcript/media
- store dubbed audio and muxed video
- show review/download states

### Phase 3: Reframe YouTube import

- rename it as channel import/history
- show top assets worth localizing
- link channel videos into localization workflow

### Phase 4: Add visible translated talking-head video

- only after V1 is already useful

## Product Story To Use

`Import founder media or a YouTube archive, transcribe it, translate it, generate English outputs, and keep the full content library searchable in one place.`

That is the sharpest version of the product right now.
