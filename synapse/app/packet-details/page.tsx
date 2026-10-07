"use client"
import { useSearchParams } from 'next/navigation'
import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Copy, Download } from 'lucide-react'

export default function PacketDetails() {
    const searchParams = useSearchParams()

    const id = searchParams.get('id')
    const type = searchParams.get('type')
    const desc = searchParams.get('desc')
    const time = searchParams.get('time')
    const details = searchParams.get('details')

    return (
        <div className="min-h-screen mt-20">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">Packet Details</h1>
                        <p className="text-slate-400">Complete information about packet #{id}</p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => window.close()}
                        className="gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Close
                    </Button>
                </div>

                <Card className="border-slate-700 bg-slate-900/50 backdrop-blur">
                    <CardHeader className="pb-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="text-2xl text-white">Packet #{id}</CardTitle>
                                <CardDescription className="text-slate-400 mt-1">
                                    Created on {time}
                                </CardDescription>
                            </div>
                            <Badge variant="secondary" className="text-sm">
                                {type}
                            </Badge>
                        </div>
                    </CardHeader>

                    <Separator className="bg-slate-700" />

                    <CardContent className="pt-6">
                        <div className="space-y-6">
                            {/* Description */}
                            <div>
                                <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                                    Description
                                </label>
                                <div className="mt-2 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                    <p className="text-slate-100 leading-relaxed">{desc || 'No description provided'}</p>
                                </div>
                            </div>

                            {/* Details */}
                            {details && (
                                <div>
                                    <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                                        Additional Details
                                    </label>
                                    <div className="mt-2 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                        <p className="text-slate-100 font-mono text-sm break-words">{details}</p>
                                    </div>
                                </div>
                            )}

                            {/* Metadata Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Packet ID</p>
                                    <p className="text-lg font-semibold text-white">{id}</p>
                                </div>
                                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Type</p>
                                    <p className="text-lg font-semibold text-white">{type}</p>
                                </div>
                                <div className="col-span-2 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Timestamp</p>
                                    <p className="text-lg font-semibold text-white">{time}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}