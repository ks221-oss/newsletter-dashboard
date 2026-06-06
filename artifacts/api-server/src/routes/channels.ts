import { Router, type IRouter } from "express";
import { db, trackedChannels } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateChannelBody, DeleteChannelParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/channels", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(trackedChannels)
      .orderBy(trackedChannels.createdAt);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch tracked channels");
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

router.post("/channels", async (req, res): Promise<void> => {
  const body = CreateChannelBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    const [created] = await db
      .insert(trackedChannels)
      .values({
        displayName: body.data.displayName,
        youtubeHandle: body.data.youtubeHandle,
      })
      .returning();
    res.status(201).json(created);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      res.status(409).json({ error: "Channel with this handle already exists" });
      return;
    }
    req.log.error({ err }, "Failed to create channel");
    res.status(500).json({ error: "Failed to create channel" });
  }
});

router.delete("/channels/:id", async (req, res): Promise<void> => {
  const params = DeleteChannelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid channel id" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(trackedChannels)
      .where(eq(trackedChannels.id, params.data.id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    res.json(deleted);
  } catch (err) {
    req.log.error({ err }, "Failed to delete channel");
    res.status(500).json({ error: "Failed to delete channel" });
  }
});

export default router;
