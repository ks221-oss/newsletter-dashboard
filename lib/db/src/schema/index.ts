import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trackedChannels = pgTable("tracked_channels", {
  id: serial("id").primaryKey(),
  displayName: text("display_name").notNull(),
  youtubeHandle: text("youtube_handle").notNull().unique(),
  scraperName: text("scraper_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrackedChannelSchema = createInsertSchema(trackedChannels).omit({ id: true, createdAt: true });
export const selectTrackedChannelSchema = createSelectSchema(trackedChannels);

export type InsertTrackedChannel = z.infer<typeof insertTrackedChannelSchema>;
export type TrackedChannel = typeof trackedChannels.$inferSelect;
