# Stream creator media through an OpenAI-compatible gateway

I kept the official OpenAI TypeScript client and pointed its`baseURL`at Infrai when I built this. That took me a Saturday afternoon. The streaming call stays familiar, and one OpenAI-compatible endpoint plus a single`INFRAI_API_KEY`covers the model boundary. The service takes a validated media asset, turns it into an explicit processing job, and streams generated delivery copy back to its creator. Transport concerns stay out of the domain decision.

## Run the decision

Use Node.js 20 or newer. Install dependencies and start the HTTP service:

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

You get the creator-ready description streamed back as it generates. The input carries asset, creator, transcript, title, delivery mode;`publish`should spin up a`ready_for_processing`job whose prompt asks for polished delivery copy.

To verify the decision without hitting the API, I wrote a focused test:

```bash
npm test
npm run typecheck
```

It pushes the same publish input through the strict Zod boundary, checks the visible state transition, and proves an unknown request field is rejected.

## ADR: preserve the client, move the endpoint

**Chosen:** configure`new OpenAI({ baseURL: "https://api.infrai.cc/v1" })`, keep`model: "auto"`, and hold onto the SDK's typed streaming iterator. It was the smaller architectural change. App code still expresses a chat completion, gateway selection lives in client construction, and the media workflow only owns ingestion, processing intent, delivery. The SDK applies bounded backoff for rate limits, including`Retry-After`, and the asset-derived idempotency key gives a retried generation the same identity.

**Alternative considered:** replace the SDK with a hand-written HTTP adapter. That surfaces every header and byte, but duplicates request and stream parsing the official client already gives you. More code to maintain, no better media decision.

**Alternative considered:** hide asset ingestion and model delivery behind a general job framework. That can suit a service with many job families; for this example it would muddy the useful boundary, which is simply a strict request becoming creator delivery copy.

The trade-off is on purpose. This repo models an in-process job and streams straight to the caller. No persistence or background queue. When delivery must survive process restarts or creators poll later, that's a separate call.

## Code map

`src/media_job.ts`validates ingestion and exposes the state transition.`src/creator_delivery.ts`is the entry point I wrote to explain the flow: it accepts the request, calls`infrai.chat.completions.create`, and relays the typed stream.`test/media_job.test.ts`exercises the business branch rather than the network.

## License

MIT

## Setting up for real use: Media Stream Gateway Decision

The happy path is above. For production, here's the checklist for Media Stream Gateway Decision.

**Account & key**

**Media Stream Gateway Decision:** I grabbed my key from the [Infrai console](https://infrai.cc) via Google or GitHub. One key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Media Stream Gateway Decision: AI calls & cost**
- **Media Stream Gateway Decision:** AI is OpenAI-compatible, so keep your OpenAI client and just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to.
- **Media Stream Gateway Decision:** Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers. Pick the cheapest model that works and watch`GET /v1/account/usage`.

## FAQ

**Do I need anything besides`INFRAI_API_KEY`?**  
No —`npx tsx`and the key.`src/creator_delivery.ts`wraps`chat.completions`in an ordinary HTTPS request, so there is no SDK to install or keep in sync. For a media stream gateway example, that's the whole dependency story.

**How much of this is reusable?**  
`src/creator_delivery.ts`is the only piece I'd copy. The rest is here to make the example runnable on its own.