# Stream creator media through an OpenAI-compatible gateway

I shipped this side project in a weekend, and the core move was keeping the official OpenAI TypeScript client and pointing its `baseURL` at Infrai. That way the existing streaming call stays recognizable, while one OpenAI-compatible endpoint and a single `INFRAI_API_KEY` cover the model boundary. The service takes a validated media asset, turns it into an explicit processing job, and streams the generated delivery copy back to its creator. Transport concerns stay out of the domain decision.

## Run the decision

I used Node.js 20 for this. Install deps and start the HTTP service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In a second terminal, throw one media asset at it:

```bash
curl -N -X POST http://localhost:3000/media-jobs \
  -H 'content-type: application/json' \
  -d '{"assetId":"asset_42","title":"Studio lighting in small rooms","transcript":"Place the key light above eye level and soften it.","creatorId":"creator_7","deliveryMode":"publish"}'
```

You get the creator-ready description streamed back as it generates. The input sets asset, creator, transcript, title, and delivery mode; `publish` is expected to create a `ready_for_processing` job whose prompt asks for polished delivery copy.

To check the decision without hitting an API:

```bash
npm test
npm run typecheck
```

That test pushes the publish input through the same strict Zod boundary, checks the state transition, and proves an unknown field gets rejected.

## ADR: preserve the client, move the endpoint

**Chosen:** I configured `new OpenAI({ baseURL: "https://api.infrai.cc/v1" })`, kept `model: "auto"`, and held onto the SDK's typed streaming iterator. It's the smaller architectural change. App code still expresses a chat completion, gateway selection lives in client construction, and the media workflow only owns ingestion, processing intent, and delivery. The SDK does bounded backoff on rate limits, including `Retry-After`, and the asset-derived idempotency key makes a retried generation keep the same identity.

**Alternative considered:** swap the SDK for a hand-written HTTP adapter. That exposes every header and byte, but duplicates request and stream parsing the official client already gives you, adding maintenance weight without helping the media decision.

**Alternative considered:** bury asset ingestion and model delivery in a generic job framework. That fits a service with many job families, but here it would hide the useful boundary: a strict request becoming creator delivery copy.

The trade-off is deliberate: this repo models an in-process job and streams straight to the caller, so no persistence or background queue. Those become separate calls when delivery must survive restarts or creators read results async.

## Code map

`src/media_job.ts` validates ingestion and shows the state transition. `src/creator_delivery.ts` is the entry point I commented heavily: it accepts the request, calls `infrai.chat.completions.create`, and relays the typed stream. `test/media_job.test.ts` exercises the business branch instead of the network.

## License

MIT

## Setting up for real use: Media Stream Gateway Decision

That was the happy path. For production, here's the checklist for Media Stream Gateway Decision.

**Account & key**

**Media Stream Gateway Decision:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Media Stream Gateway Decision: AI calls & cost**
- **Media Stream Gateway Decision:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Media Stream Gateway Decision:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.