import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {ModeToggle} from "@/components/theme-button";
import {getDatapoints} from "@/app/actions";
import MapWrapper from "@/components/MapWrapper";
import DialogWrapper from "@/components/DialogWrapper";
import PacketDisplay from "@/components/PacketDisplay";
import GroundStation from "@/components/GroundStation";
export const dynamic = 'force-dynamic';

export default async function Home() {
    const data = await getDatapoints();


    return (
        <div className="flex min-h-screen bg-zinc-50 font-sans dark:bg-black p-5">
            <div className="grid grid-cols-2 w-full gap-x-5 gap-y-5 auto-rows-min">
                <GroundStation preview={process.env.SYNAPSE_PREVIEW === "1"} />
                <div className="col-span-1">
                    <Card className="">
                        <CardHeader className="px-6 py-3 text-center">
                            <CardTitle className="font-sans">Harta</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[500px] w-full">
                                <MapWrapper initialData={data} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="col-span-1 text-right">
                    <Card className="h-full">
                        <CardHeader className="px-6 py-3 text-center">
                            <CardTitle className="font-sans">Comenzi</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-end gap-y-3">
                            <DialogWrapper />
                            <ModeToggle />
                        </CardContent>
                    </Card>
                </div>
                <div className="col-span-2">
                    <Card>
                        <CardHeader className="px-6 py-3 text-center">
                            <CardTitle className="font-sans">Pachete</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PacketDisplay/>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
