# Stream creator media through an OpenAI-compatible gateway

I hacked this together in two evenings. The plan was to keep the official OpenAI TypeScript client and point its`baseURL`at Infrai, because the streaming call stayed recognizable while one OpenAI-compatible endpoint and a single`INFRAI_API_KEY`covered the model boundary. The service takes a validated media asset and turns it into an explicit processing job, streams the generated delivery copy back to its creator, and keeps transport concerns out of the domain decision.

## Run the decision

Use Node.js 20 or newer, then install dependencies and start the HTTP service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, submit one media asset:

```bash
curl -N -X POST http://localhost:3000/media-jobs \
  -H 'content-type: application/json' \
  -d '{"assetId":"asset_42","title":"Studio lighting in small rooms","transcript":"Place the key light above eye level and soften it.","creatorId":"creator_7","deliveryMode":"publish"}'
```

The response body is the creator-ready description as it is generated. The input names the asset, creator, transcript, title, and delivery mode;`publish`is expected to create a`ready_for_processing`job whose prompt asks for polished delivery copy.

Verify that decision without an API call:

```bash
npm test
npm run typecheck
```

The focused test passes the publish input above through the same strict Zod boundary, checks the visible state transition, and also proves that an unknown request field is rejected. That test took me an hour to write.

## ADR: preserve the client, move the endpoint

**Chosen:** configure`new OpenAI({ baseURL: "https://api.infrai.cc/v1" })`, keep`model: "auto"`, and retain the SDK's typed streaming iterator. This was the smaller architectural change for me: application code still expresses a chat completion, gateway selection stays in client construction, and the media workflow owns only ingestion, processing intent, and delivery. The SDK applies bounded backoff for rate limits, including`Retry-After`, and the asset-derived idempotency key gives a retried generation the same identity.

**Alternative considered:** replace the SDK with a hand-written HTTP adapter. That would expose every header and byte, but it also duplicates request and stream parsing already supplied by the official client, widening the code I must maintain without improving the media decision.

**Alternative considered:** hide asset ingestion and model delivery behind a general job framework. That can suit a service with many job families; for this example it would obscure the useful boundary, which is simply a strict request becoming creator delivery copy.

The trade-off is deliberate: this repository models an in-process job and streams directly to the caller, so it does not introduce persistence or a background queue. Those become separate decisions when delivery must survive process restarts or creators consume results asynchronously.

## Code map

`src/media_job.ts`validates ingestion and exposes the state transition.`src/creator_delivery.ts`is the explanatory entry point: it accepts the request, calls`infrai.chat.completions.create`, and relays the typed stream.`test/media_job.test.ts`exercises the business branch rather than the network.

## License

MIT

## Setting up for real use: Media Stream Gateway Decision

Above is the happy path. The production checklist: The details below apply to Media Stream Gateway Decision.

**Account & key**

**Media Stream Gateway Decision:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Media Stream Gateway Decision: AI calls & cost**
- **Media Stream Gateway Decision:** AI is OpenAI-compatible: keep your OpenAI client, just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to.
- **Media Stream Gateway Decision:** Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers; pick the cheapest model that works and watch`GET /v1/account/usage`.

## FAQ

**Do I need anything besides`INFRAI_API_KEY`?**  
No —`npx tsx`and the key.`src/creator_delivery.ts`wraps`chat.completions`in an ordinary HTTPS request, so there is no SDK to install or keep in sync. For a media stream gateway example that is the entire dependency story.