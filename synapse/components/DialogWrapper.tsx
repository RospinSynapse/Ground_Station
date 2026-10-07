"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { addDatapoint } from "@/app/actions"
import { Loader2 } from "lucide-react"
import { useFormStatus } from "react-dom"
import axios from "axios";

function SubmitButton() {
    const { pending } = useFormStatus()

    return (
        <Button type="submit" className="cursor-pointer" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pending ? "Submitting..." : "Submit"}
        </Button>
    )
}

export default function DialogWrapper() {
    const [open, setOpen] = useState(false)

    const handleSubmit = async (formData: FormData) => {
        try {
            await axios.post("/api/packet/createMapPoint", {
                data: {
                    lat: formData.get("lat"),
                    long: formData.get("long"),
                    terrain: formData.get("terrain"),
                }
            })
        }catch(error) {
            console.log(error);
        }
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="cursor-pointer blue">
                    Manual Datapoint
                </Button>
            </DialogTrigger>

            <DialogContent className="z-[10000]">
                <form action={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add manual datapoint:</DialogTitle>
                        <DialogDescription>
                            For testing purposes.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-3">
                            <Label htmlFor="lat">Latitude</Label>
                            <Input id="lat" name="lat" defaultValue="44.43225" required />
                        </div>

                        <div className="grid gap-3">
                            <Label htmlFor="long">Longitude</Label>
                            <Input id="long" name="long" defaultValue="26.10626" required />
                        </div>

                        <div className="grid gap-3">
                            <Label htmlFor="terrain">Terrain Type (1–6)</Label>
                            <Input
                                id="terrain"
                                name="terrain"
                                type="number"
                                min="1"
                                max="6"
                                defaultValue="2"
                                required
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>

                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
