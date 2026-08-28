import { CallRoom } from "@/components/call/call-room";

export default function CallPage({ params }: { params: { id: string } }) {
  return <CallRoom callRoomId={params.id} />;
}
