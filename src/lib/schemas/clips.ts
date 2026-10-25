import { z } from "zod";

/** One clip cut from the recording, as stored in sources.clips_json. */
export const Clip = z.object({
  id: z.string(),
  start: z.number(),
  duration: z.number(),
  path: z.string(),
  poster_path: z.string(),
});
export type Clip = z.infer<typeof Clip>;
export const Clips = z.array(Clip);
