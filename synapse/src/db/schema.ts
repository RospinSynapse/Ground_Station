import { int, sqliteTable, real, text } from "drizzle-orm/sqlite-core";

export const datapoints = sqliteTable("datapoints", {
    id: int("id").primaryKey({ autoIncrement: true }),
    lat: real("Lat").notNull(),
    long: real("Long").notNull(),
    terrain: int("terrain").notNull(),
});

export const packets = sqliteTable("packets", {
    id: int("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    desc: text("desc").notNull(),
    time: text("time").notNull(),
    details: text("details").notNull(),

})