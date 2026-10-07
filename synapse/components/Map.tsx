'use client'
import 'leaflet/dist/leaflet.css'
import { Polygon } from 'react-leaflet'
import { MapContainer, TileLayer } from "react-leaflet";
import { useEffect, useState } from 'react';
import {Polygon as poly} from "@/lib/utils"

export default function Map({ initialData }: { initialData: poly[] }) {
    const [data, setData] = useState(initialData);

    useEffect(() => {
        console.log("initialData changed:", initialData);
        setData(initialData);
    }, [initialData]);

    return (
        <MapContainer
            center={[44.4323056, 26.1073889]}
            zoom={13}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {data.map((item, i) => {
                let color;
                switch (item.terrain){
                    case 1:
                        color="red";
                        break;
                    case 2:
                        color="brown";
                        break;
                    case 3:
                        color="blue";
                        break;
                    case 4:
                        color="pink";
                        break;
                    case 5:
                        color="purple";
                        break;
                    case 6:
                        color="green";
                        break;
                    default:
                        color="black";
                }
                return(
                    <Polygon
                        key={i}
                        positions={[
                            [item.lat - 0.101, item.long - 0.248],
                            [item.lat + 0.101, item.long - 0.248],
                            [item.lat + 0.101, item.long + 0.248],
                            [item.lat - 0.101, item.long + 0.248]
                        ]}
                        pathOptions={{ color: color, fillOpacity: 0.5 }}
                    />
                )})}
        </MapContainer>
    );
}