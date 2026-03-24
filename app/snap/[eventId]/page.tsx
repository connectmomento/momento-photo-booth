"use client"

import { useState, useRef, useEffect } from "react"
import { RefreshCw, CheckCircle, Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"

export default function SnapPage() {
  const params = useParams()
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [isCapturing, setIsCapturing] = useState(false)
  const [showDownload, setShowDownload] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remainingPhotos, setRemainingPhotos] = useState<number | null>(null)
  const [eventData, setEventData] = useState<any>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const getGuestId = () => {
    if (typeof window === "undefined") return "anon"
    let id = localStorage.getItem(`guest_${params?.eventId}`)
    if (!id) {
      id = `g_${Math.random().toString(36).substring(7)}`
      localStorage.setItem(`guest_${params?.eventId}`, id)
    }
    return id
  }

  useEffect(() => {
    async function loadEvent() {
      const eventId = params?.eventId as string
      if (!eventId || eventId === "unidentified") return

      const { data: event } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle()
      if (event) {
        setEventData(event)
        const { count } = await supabase.from("photos").select("id", { count: "exact" }).eq("event_id", eventId)
        setRemainingPhotos((event.photo_limit || 25) - (count || 0))
        // 2. Get THIS SPECIFIC GUEST'S photo count
        const guestId = getGuestId() // This gets the ID saved in this phone's memory
        
        const { count } = await supabase
          .from("photos")
          .select("id", { count: "exact" })
          .eq("event_id", eventId)
          .eq("guest_id", guestId) // <--- THIS IS THE KEY CHANGE
        // 3. Calculate remaining based on the Admin's limit
        const limit = event.photo_limit || 25
        const used = count || 0
        setRemainingPhotos(limit - used)
      }
    }
    loadEvent()
  }, [params])

  // CRITICAL: Stop old camera before starting new one
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
          video: { 
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        })
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (err) {
        setError("Camera Access Error. Please check browser permissions.")
      }
    }
    startCamera()
    return () => stopCamera()
  }, [facingMode])

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing || (remainingPhotos !== null && remainingPhotos <= 0)) return

    setIsCapturing(true)
    const canvas = canvasRef.current
    const video = videoRef.current
    
    // Set canvas to actual video size
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    ctx.drawImage(video, 0, 0)
    const imageData = canvas.toDataURL("image/jpeg", 0.8)

    // 1. Save to Phone
    const link = document.createElement("a")
    link.href = imageData
    link.download = `momento-${Date.now()}.jpg`
    link.click()

    // 2. Upload to Supabase
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setIsCapturing(false)
        return
      }

      const eventId = params?.eventId as string
      const guestId = getGuestId()
      const filePath = `${eventId}/${guestId}/${Date.now()}.jpg`

      // Ensure 'photos' bucket exists in Supabase Storage and is PUBLIC
      const { data, error: upErr } = await supabase.storage.from("photos").upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true
      })

      if (upErr) {
        console.error("Upload Failed:", upErr)
        alert("Upload failed. Check if 'photos' bucket is Public in Supabase!")
        setIsCapturing(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(filePath)
      
      const { error: dbErr } = await supabase.from("photos").insert([{ 
        event_id: eventId, 
        url: publicUrl, 
        guest_id: guestId 
      }])

      if (!dbErr) {
        setRemainingPhotos(prev => (prev !== null ? prev - 1 : null))
        setShowDownload(true)
      }
      setIsCapturing(false)
    }, "image/jpeg")
  }

  if (error) return <div className="min-h-screen bg-stone-950 flex items-center justify-center p-10 text-amber-600 text-center font-mono">{error}</div>

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center p-4 font-mono text-amber-100">
      <div className="w-full max-w-md flex justify-between mb-4 px-2 text-[10px] tracking-widest uppercase opacity-60">
        <span>{eventData?.name || "CONNECTING..."}</span>
        <span className={remainingPhotos && remainingPhotos < 5 ? "text-red-500 animate-pulse" : ""}>
          {remainingPhotos ?? "--"} LEFT
        </span>
      </div>

      <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-3xl overflow-hidden border-4 border-stone-800 shadow-2xl">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        
        {showDownload && (
          <div className="absolute inset-0 bg-stone-950/98 z-30 flex flex-col items-center justify-center p-6 text-center">
            <CheckCircle className="w-16 h-16 text-amber-600 mb-4" />
            <h2 className="text-xl mb-6 uppercase tracking-widest">Saved</h2>
            <button onClick={() => setShowDownload(false)} className="bg-amber-600 text-stone-950 px-12 py-4 rounded-full font-bold text-xs">READY FOR NEXT</button>
          </div>
        )}

        <button 
          onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")} 
          className="absolute top-4 right-4 z-20 bg-black/40 p-3 rounded-full border border-white/10"
        >
          <RefreshCw className="w-5 h-5 text-amber-100" />
        </button>
      </div>

      <button 
        onClick={capturePhoto}
        disabled={isCapturing || (remainingPhotos !== null && remainingPhotos <= 0)}
        className={`mt-10 w-20 h-20 rounded-full border-[6px] border-stone-800 transition-all ${isCapturing ? 'bg-red-600 animate-pulse' : 'bg-stone-100 active:scale-90 shadow-xl'}`}
      />
      <canvas ref={canvasRef} className="hidden" />
      <p className="mt-4 text-[9px] text-stone-600 uppercase tracking-widest">
        {isCapturing ? "Processing Snap..." : "Tap to capture memory"}
      </p>
    </div>
  )
}
{remainingPhotos !== null && remainingPhotos <= 0 && (
  <div className="absolute inset-0 bg-stone-950 z-50 flex flex-col items-center justify-center p-10 text-center">
    <ImageIcon className="w-16 h-16 text-amber-600 mb-6 opacity-20" />
    <h2 className="text-xl font-bold text-amber-100 uppercase tracking-tighter">Limit Reached</h2>
    <p className="text-stone-500 text-xs mt-4 uppercase tracking-widest leading-relaxed">
      You've captured all your allowed memories for this event. 
      Visit the gallery to view and download them!
    </p>
    <button 
      onClick={() => window.open(`/event/${params?.eventId}`, '_blank')}
      className="mt-10 border border-amber-600/30 text-amber-600 px-8 py-3 rounded-full text-[10px] tracking-widest uppercase"
    >
      View Gallery
    </button>
  </div>
)}
