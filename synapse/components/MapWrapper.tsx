'use client'
import dynamic from "next/dynamic";
import { Polygon } from "@/lib/utils";
import { useState, useEffect } from "react";
import { getDatapoints } from "@/app/actions";

const Map = dynamic(() => import("@/components/Map"), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-gray-200 flex items-center justify-center">Loading map...</div>
});

export default function MapClient({ initialData }: { initialData: Polygon[] }) {
    const [data, setData] = useState(initialData);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await getDatapoints();
                console.log("Fetched data:", response);
                setData(response);
            } catch (err) {
                console.error("Fetch error:", err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, parseInt(process.env.RELOAD_TIME? process.env.RELOAD_TIME : "1000"));
        return () => clearInterval(interval);
    }, []);

    console.log("MapClient rendering with data:", data);

    return <Map initialData={data} />;
}