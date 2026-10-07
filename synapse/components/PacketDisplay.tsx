"use client"
import React, {useEffect, useState} from 'react'
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {getPackets} from "@/app/actions";
import {Packet} from "@/lib/utils";
import {Button} from "@/components/ui/button";

function PacketDisplay() {

    const [data, setData] = useState<Packet[]>([])

    const popDetails = (item : Packet, index: number) => {
        const params = new URLSearchParams({
            id: String(index),
            type: item.type,
            desc: item.desc,
            time: item.time,
            details: item.details
        })
        window.open(`/packet-details?${params.toString()}`, '_blank')
    }

    //Refresh packet table data every 5 seconds.
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await getPackets(); // change to your endpoint
                setData(response);
            } catch (err) {
                console.log(err);
            }
        }

        fetchData()

        const interval = setInterval(fetchData, parseInt(process.env.RELOAD_TIME? process.env.RELOAD_TIME : "1000"))
        return () => clearInterval(interval)
    }, [])

    return (
        <Table>
            <TableCaption>Packets</TableCaption>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {
                    data.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-medium">{index}</TableCell>
                            <TableCell>{item.type}</TableCell>
                            <TableCell>{item.desc}</TableCell>
                            <TableCell className="text-right">{item.time}</TableCell>
                            <TableCell className="text-center"><Button className="cursor-pointer" variant="secondary" onClick = {() => popDetails(item, index)}>Details</Button></TableCell>
                        </TableRow>
                    ))
                }
            </TableBody>
        </Table>
    )
}

export default PacketDisplay
