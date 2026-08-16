import assert from "node:assert/strict";
import test from "node:test";
import { ingestMediaAsset, mediaJobRequest } from "../src/media_job.js";

test("a publish asset becomes creator-ready processing work", () => {
  const input = mediaJobRequest.parse({
    assetId: "asset_42",
    title: "Studio lighting in small rooms",
    transcript: "Place the key light above eye level and soften it.",
    creatorId: "creator_7",
    deliveryMode: "publish"
  });

  const job = ingestMediaAsset(input);

  assert.equal(job.state, "ready_for_processing");
  assert.match(job.prompt, /polished creator-ready description/);
  assert.match(job.prompt, /Studio lighting in small rooms/);
});

test("unknown request fields are rejected at ingestion", () => {
  const result = mediaJobRequest.safeParse({
    assetId: "asset_42",
    title: "Studio lighting",
    transcript: "A short transcript",
    creatorId: "creator_7",
    deliveryMode: "preview",
    priority: "urgent"
  });

  assert.equal(result.success, false);
});
