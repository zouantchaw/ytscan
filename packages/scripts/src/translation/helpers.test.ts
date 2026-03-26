import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSrt,
  buildVtt,
  chunkTranscriptSegments,
  type TranscriptSegmentPayload,
} from "./helpers.js";

const SAMPLE_SEGMENTS: TranscriptSegmentPayload[] = [
  {
    segmentIndex: 0,
    startTime: 0,
    endTime: 1.42,
    text: " Bonjour   tout le monde ",
  },
  {
    segmentIndex: 1,
    startTime: 1.42,
    endTime: 3.1,
    text: "Ici on parle de petites entreprises rentables.",
  },
  {
    segmentIndex: 2,
    startTime: 3.1,
    endTime: 5.2,
    text: "Ce transcript doit rester horodate et exportable.",
  },
];

test("chunkTranscriptSegments keeps ordering and normalizes whitespace", () => {
  const batches = chunkTranscriptSegments(SAMPLE_SEGMENTS, 70, 2);

  assert.equal(batches.length, 2);
  assert.deepEqual(
    batches.map((batch: { startIndex: number }) => batch.startIndex),
    [0, 2]
  );
  assert.equal(batches[0].segments.length, 2);
  assert.equal(batches[1].segments.length, 1);
  assert.equal(batches[0].segments[0].text, "Bonjour tout le monde");
});

test("buildSrt returns numbered subtitle blocks", () => {
  const srt = buildSrt(SAMPLE_SEGMENTS);

  assert.match(srt, /^1\n00:00:00,000 --> 00:00:01,420\nBonjour tout le monde/m);
  assert.match(srt, /\n2\n00:00:01,420 --> 00:00:03,100\nIci on parle de petites entreprises rentables\./m);
  assert.ok(!srt.endsWith("\n\n"));
});

test("buildVtt returns WEBVTT payload with dot timestamps", () => {
  const vtt = buildVtt(SAMPLE_SEGMENTS);

  assert.match(vtt, /^WEBVTT/);
  assert.match(vtt, /00:00:00\.000 --> 00:00:01\.420/);
  assert.match(vtt, /Ce transcript doit rester horodate et exportable\./);
});
