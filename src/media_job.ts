import { z } from "zod";

export const mediaJobRequest = z.object({
  assetId: z.string().min(1),
  title: z.string().min(1).max(120),
  transcript: z.string().min(1),
  creatorId: z.string().min(1),
  deliveryMode: z.enum(["preview", "publish"])
}).strict();

export type MediaJobRequest = z.infer<typeof mediaJobRequest>;

export type MediaJob = MediaJobRequest & {
  state: "ready_for_processing";
  prompt: string;
};

export function ingestMediaAsset(input: MediaJobRequest): MediaJob {
  const deliveryInstruction = input.deliveryMode === "publish"
    ? "Return a polished creator-ready description."
    : "Return a concise preview description for editorial review.";

  return {
    ...input,
    state: "ready_for_processing",
    prompt: [
      `Create delivery copy for the media asset titled: ${input.title}`,
      deliveryInstruction,
      `Transcript: ${input.transcript}`
    ].join("\n")
  };
}
