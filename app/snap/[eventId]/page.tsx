"use client"

import { useState, useRef, useEffect } from "react"
import { RefreshCw, CheckCircle, Camera, Image as ImageIcon } from "lucide-react"
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

  // Retrieves or creates a persistent Guest ID for this specific event
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

      // Fetch event settings
      const { data: event } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle()
      
      if (event) {
        setEventData(event)
        const guestId = getGuestId()
        
        // Fetch specific photo count for THIS guest only
        const { count: guestPhotoCount } = await supabase
          .from("photos")
          .select("id", { count: "exact" })
          .eq("event_id", eventId)
          .eq("guest_id", guestId)

        const limit = event.photo_limit || 25
        const used = guestPhotoCount || 0
        setRemainingPhotos(limit - used)
      }
    }
    loadEvent()
  }, [params])

  // Properly stops all camera tracks to prevent hardware "locking"
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
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    ctx.drawImage(video, 0, 0)
    const imageData = canvas.toDataURL("image/jpeg", 0.8)

    // 1. Instant local download for the guest
    const link = document.createElement("a")
    link.href = imageData
    link.download = `momento-${Date.now()}.jpg`
    link.click()

    // 2. Upload to Cloud (Supabase Storage + Database)
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setIsCapturing(false)
        return
      }

      const eventId = params?.eventId as string
      const guestId = getGuestId()
      const filePath = `${eventId}/${guestId}/${Date.now()}.jpg`

      const { error: upErr } = await supabase.storage.from("photos").upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true
      })

      if (upErr) {
        console.error("Upload Failed:", upErr)
        alert("Upload failed. Verify 'photos' bucket is Public in Supabase.")
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

  if (error) return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-10 text-amber-600 text-center font-mono italic text-xs">
      {error}
    </div>
  )

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center p-4 font-mono text-amber-100 overflow-hidden relative">
      {/* HUD Header */}
      <div className="w-full max-w-md flex justify-between mb-4 px-2 text-[10px] tracking-widest uppercase opacity-60">
        <span className="truncate mr-4">{eventData?.name || "CONNECTING..."}</span>
        <span className={remainingPhotos !== null && remainingPhotos < 5 ? "text-red-500 animate-pulse" : ""}>
          {remainingPhotos ?? "--"} LEFT
        </span>
      </div>

      {/* Viewfinder Wrapper */}
      <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-3xl overflow-hidden border-4 border-stone-800 shadow-2xl">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        
        {/* Post-Capture Success Overlay */}
        {showDownload && (
          <div className="absolute inset-0 bg-stone-950/98 z-30 flex flex-col items-center justify-center p-6 text-center">
            <CheckCircle className="w-16 h-16 text-amber-600 mb-4" />
            <h2 className="text-xl mb-6 uppercase tracking-widest font-bold">Saved</h2>
            <button 
              onClick={() => setShowDownload(false)} 
              className="bg-amber-600 text-stone-950 px-12 py-4 rounded-full font-bold text-[10px] tracking-widest uppercase active:scale-95 transition-transform"
            >
              Ready For Next
            </button>
          </div>
        )}

        {/* Camera Toggle */}
        <button 
          onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")} 
          className="absolute top-4 right-4 z-20 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md active:bg-amber-600/50"
        >
          <RefreshCw className="w-5 h-5 text-amber-100" />
        </button>
      </div>

      {/* Main Shutter Button */}
      <div className="flex flex-col items-center mt-10">
        <button 
          onClick={capturePhoto}
          disabled={isCapturing || (remainingPhotos !== null && remainingPhotos <= 0)}
          className={`w-20 h-20 rounded-full border-[6px] border-stone-800 transition-all ${
            isCapturing ? 'bg-red-600 animate-pulse' : 'bg-stone-100 active:scale-90 shadow-[0_0_20px_rgba(255,255,255,0.1)]'
          } disabled:bg-stone-800 disabled:opacity-50`}
        />
        <p className="mt-4 text-[9px] text-stone-600 uppercase tracking-[0.3em]">
          {isCapturing ? "Processing..." : "Capture Memory"}
        </p>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Full-Screen Limit Reached Overlay */}
      {remainingPhotos !== null && remainingPhotos <= 0 && (
        <div className="absolute inset-0 bg-stone-950 z-50 flex flex-col items-center justify-center p-10 text-center">
          <ImageIcon className="w-16 h-16 text-amber-600 mb-6 opacity-20" />
          <h2 className="text-xl font-bold text-amber-100 uppercase tracking-tighter">Limit Reached</h2>
          <p className="text-stone-500 text-[10px] mt-4 uppercase tracking-widest leading-relaxed">
            You've reached your snap limit for this event.<br />
            Visit the live gallery to view all photos!
          </p>
          <button 
            onClick={() => window.open(`/event/${params?.eventId}`, '_blank')}
            className="mt-10 border border-amber-600/30 text-amber-600 px-10 py-4 rounded-full text-[10px] tracking-widest uppercase hover:bg-amber-600/10 transition-colors"
          >
            Open Live Gallery
          </button>
        </div>
      )}
    </div>
  )
}
