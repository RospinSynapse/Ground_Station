'use server'

import { db } from "@/src/db"
import {datapoints, packets} from "@/src/db/schema"
import { redirect } from "next/navigation"
import {Polygon, Packet} from "@/lib/utils"

export async function addDatapoint(formData: FormData) {
    const lat = Number(formData.get("lat"))
    const long = Number(formData.get("long"))
    const terrain = Number(formData.get("terrain"))

    const value: typeof datapoints.$inferInsert = {
        lat,
        long,
        terrain,
    }

    await db.insert(datapoints).values(value)

    redirect("/")
}

export async function getDatapoints() {
    return await db.select().from(datapoints);
}

export async function getPackets() {
    return await db.select().from(packets);
}


export async function addDatapointAPI(Polygon : Polygon) {
    const lat = Number(Polygon["lat"])
    const long = Number(Polygon["long"])
    const terrain = Number(Polygon["terrain"])

    const value: typeof datapoints.$inferInsert = {
        lat,
        long,
        terrain,
    }

    await db.insert(datapoints).values(value)
}

export async function addPacket(Packet : Packet){
    const desc = String(Packet["desc"]);
    const type = String(Packet["type"]);
    const time = String(Packet["time"]);
    const details = String(Packet["details"]);

    const value: typeof packets.$inferInsert = {
        type,
        desc,
        time,
        details
    }

    await db.insert(packets).values(value);
}