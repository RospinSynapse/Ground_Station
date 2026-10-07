import { NextRequest, NextResponse } from "next/server";
import {addDatapointAPI, addPacket} from "@/app/actions";
import {Packet, Polygon} from "@/lib/utils"

export const POST = async (
    req: NextRequest
) => {
    try {
        const { data } = await req.json(); // request body
        console.log(data);

        if (!data) {
            return NextResponse.json(
                { error: "Invalid request body" },
                { status: 400 }
            );
        }

        try {
            const Point = new Polygon(data.lat, data.long, data.terrain);
            console.log("Point created:", Point);
            await addDatapointAPI(Point);
            const date = new Date().toLocaleString("en-DE", {
                month: "short",
                day: "2-digit",
                year: "numeric",
                minute: "2-digit",
                hour: "2-digit",
                timeZone: 'Europe/Athens'
            });
            const packet = new Packet("createMapPoint", date, "Created new map datapoint", JSON.stringify(Point));
            await addPacket(packet);
            return NextResponse.json({ success: true }, { status: 201 });
        } catch (err) {
            console.error("CreateMapPoint error:", err);
            throw err;
        }

    } catch (error) {
        console.error("Error processing request:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
};
