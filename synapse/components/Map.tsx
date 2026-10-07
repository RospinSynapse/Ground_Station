'use client'
import 'leaflet/dist/leaflet.css'
import { Polygon, CircleMarker, Popup } from 'react-leaflet'
import { SOURCE_NAMES } from '@/lib/ground/protocol'
import type { GroundSnapshot } from '@/lib/ground/store'
import { MapContainer, TileLayer } from "react-leaflet";

import {Polygon as poly} from "@/lib/utils"

export default function Map({ initialData, images, sources, points }: { initialData: poly[]; images: GroundSnapshot["images"]; sources: GroundSnapshot["sources"]; points: GroundSnapshot["points"] }) {
    const data = initialData;

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
            {sources.map(item => {
                const packet = item.position?.packet;
                const gps = packet && 'gps' in packet ? packet.gps : null;
                if (!gps) return null;
                return <CircleMarker key={item.source} center={[gps.latitude, gps.longitude]} radius={10} pathOptions={{ color: item.source === 'gsm' ? '#9333ea' : item.source === 'tinygs' ? '#0891b2' : '#e11d48' }}><Popup>{SOURCE_NAMES[item.source]}<br />{packet?.missionId}<br />Altitude: {gps.altitudeM ?? 'unknown'} m<br />Fix time: {packet?.timestamp}<br />Received: {item.position?.receivedAt}</Popup></CircleMarker>;
            })}
            {points.map(item => item.packet.type === 'classification_point' && <CircleMarker key={`point-${item.id}`} center={[item.packet.gps.latitude, item.packet.gps.longitude]} radius={4} pathOptions={{color: '#d97706'}}><Popup>{item.packet.imageId} / segment {item.packet.segmentIndex}<br />Class {item.packet.classId}<br />{SOURCE_NAMES[item.source]} — {item.packet.missionId}</Popup></CircleMarker>)}
            {images.map(image => <CircleMarker key={`${image.source}:${image.missionId}:${image.imageId}`} center={[image.gps.latitude, image.gps.longitude]} radius={7} pathOptions={{ color: image.complete ? 'green' : 'orange' }}>
                <Popup>{image.missionId} / {image.imageId}<br />{image.received}/{image.totalSegments} classified tiles<br />Photo GPS only; footprint unknown.</Popup>
            </CircleMarker>)}
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
