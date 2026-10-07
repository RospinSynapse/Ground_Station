import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export class Polygon {
    constructor(public lat: number, public long: number, public terrain: number) {}
}

export class Packet {
    constructor(public type: string, public time: string, public desc: string, public details: string) {}
}