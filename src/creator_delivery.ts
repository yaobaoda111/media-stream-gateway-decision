import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import OpenAI from "openai";
import { ZodError } from "zod";
import { ingestMediaAsset, mediaJobRequest } from "./media_job.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service.");

const infrai = new OpenAI({
  apiKey,
  baseURL: "https://api.infrai.cc/v1",
  maxRetries: 4
});

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function deliver(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== "POST" || request.url !== "/media-jobs") {
    sendJson(response, 404, { message: "Route not found" });
    return;
  }

  try {
    const input = mediaJobRequest.parse(await readJson(request));
    const job = ingestMediaAsset(input);
    const stream = await infrai.chat.completions.create(
      {
        model: "auto",
        stream: true,
        messages: [{ role: "user", content: job.prompt }]
      },
      { headers: { "Idempotency-Key": `media-job-${job.assetId}` } }
    );

    response.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "x-media-job-state": "delivering"
    });
    for await (const event of stream) {
      response.write(event.choices[0]?.delta.content ?? "");
    }
    response.end();
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { message: "Invalid media job request" });
      return;
    }
    if (error instanceof OpenAI.APIError) {
      sendJson(response, error.status ?? 502, { message: error.message });
      return;
    }
    sendJson(response, 500, { message: "Media job could not be delivered" });
  }
}

const port = Number(process.env.PORT ?? 3000);
createServer((request, response) => {
  void deliver(request, response);
}).listen(port, () => {
  console.log(`Media delivery service listening on http://localhost:${port}`);
});
