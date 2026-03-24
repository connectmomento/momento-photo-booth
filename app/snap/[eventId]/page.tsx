"use client"

import { useState, useRef, useEffect } from "react"
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function SnapPage({ params }: { params: { eventId: string } }) {
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [isCapturing, setIsCapturing] = useState(false)
  const [showDownload, setShowDownload] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remainingPhotos, setRemainingPhotos] = useState<number | null>(null)
  const [eventData, setEventData] = useState<any>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 1. Better Guest ID Logic
  const getGuestId = () => {
    if (typeof window === "undefined") return "server"
    let id = localStorage.getItem(`guest_${params.eventId}`)
    if (!id) {
      id = `g_${Math.random().toString(36).substring(7)}`
      localStorage.setItem(`guest_${params.eventId}`, id)
    }
    return id
  }

  // 2. Load Event with Debugging
  useEffect(() => {
    async function loadEvent() {
      // 1. Safety Check: If eventId is "unidentified" or too short, stop immediately
      if (!params.eventId || params.eventId === "unidentified" || params.eventId.length < 10) {
        console.error("Invalid Event ID detected:", params.eventId);
        setError("Invalid Link: Please rescan the QR code from the Admin Dashboard.");
        return;
      }

      const { data: event, error: eventErr } = await supabase
        .from("events")
        .select("*")
        .eq("id", params.eventId)
        .maybeSingle();

      if (eventErr) {
        setError(`Database Error: ${eventErr.message}`);
        return;
      }

      if (!event) {
        setError("Event Not Found. Please check the Admin Dashboard.");
        return;
      }

      setEventData(event);

      const { count } = await supabase
        .from("photos")
        .select("id", { count: "exact" })
        .eq("event_id", params.eventId);

      setRemainingPhotos((event.photo_limit || 25) - (count || 0));
    }
    loadEvent();
  }, [params.eventId]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  useEffect(() => {
    async function startCamera() {
      stopCamera()
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode } 
        })
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (err) {
        setError("Camera access denied.")
      }
    }
    startCamera()
    return () => stopCamera()
  }, [facingMode])

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing || (remainingPhotos !== null && remainingPhotos <= 0)) return

    setIsCapturing(true)
    const canvas = canvasRef.current
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    ctx.drawImage(videoRef.current, 0, 0)
    const imageData = canvas.toDataURL("image/jpeg", 0.8)

    // Download to phone
    const link = document.createElement("a")
    link.href = imageData
    link.download = `snap-${Date.now()}.jpg`
    link.click()

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const guestId = getGuestId()
      const filePath = `${params.eventId}/${guestId}/${Date.now()}.jpg`

      const { error: upErr } = await supabase.storage.from("photos").upload(filePath, blob)
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(filePath)
        await supabase.from("photos").insert([{ 
          event_id: params.eventId, 
          url: publicUrl, 
          guest_id: guestId 
        }])
        setRemainingPhotos(prev => (prev !== null ? prev - 1 : null))
        setShowDownload(true)
      }
      setIsCapturing(false)
    }, "image/jpeg")
  }

  if (error) return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-10 text-center font-mono">
      <AlertCircle className="text-amber-600 w-12 h-12 mb-4" />
      <h2 className="text-amber-100 text-sm mb-2 uppercase tracking-widest font-bold">System Error</h2>
      <p className="text-stone-500 text-xs">{error}</p>
      <button onClick={() => window.location.reload()} className="mt-6 text-amber-600 underline text-[10px]">RETRY CONNECTION</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center p-4 font-mono text-amber-100">
      <div className="w-full max-w-md flex justify-between mb-4 px-2 text-[10px] tracking-widest uppercase opacity-60">
        <span>{eventData?.name || "AUTHENTICATING..."}</span>
        <span>{remainingPhotos ?? "--"} LEFT</span>
      </div>

      <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-3xl overflow-hidden border-4 border-stone-800 shadow-2xl">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        
        {showDownload && (
          <div className="absolute inset-0 bg-stone-950/98 z-30 flex flex-col items-center justify-center p-6 text-center">
            <CheckCircle className="w-16 h-16 text-amber-600 mb-4" />
            <h2 className="text-xl mb-6 uppercase tracking-tighter text-amber-100">Saved to Gallery</h2>
            <button onClick={() => setShowDownload(false)} className="bg-amber-600 text-stone-950 px-12 py-4 rounded-full font-bold text-xs">NEXT SNAP</button>
          </div>
        )}

        <button onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")} className="absolute top-4 right-4 z-20 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <button 
        onClick={capturePhoto}
        disabled={isCapturing || (remainingPhotos !== null && remainingPhotos <= 0)}
        className={`mt-10 w-24 h-24 rounded-full border-[8px] border-stone-800 transition-all ${isCapturing ? 'bg-red-500' : 'bg-stone-100 active:scale-90 shadow-[0_0_20px_rgba(255,255,255,0.1)]'}`}
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
