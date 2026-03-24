"use client"

import { useState, useRef, useEffect } from "react"
import { RefreshCw, Download, Camera, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function SnapPage({ params }: { params: { eventId: string } }) {
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [lastPhotoUrl, setLastPhotoUrl] = useState<string | null>(null)
  const [showDownload, setShowDownload] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remainingPhotos, setRemainingPhotos] = useState<number>(0)
  const [eventData, setEventData] = useState<any>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 1. Unique Guest ID per event (Stored in Phone Browser)
  const getGuestId = () => {
    let id = localStorage.getItem(`guest_${params.eventId}`)
    if (!id) {
      id = `guest_${Math.random().toString(36).substring(7)}`
      localStorage.setItem(`guest_${params.eventId}`, id)
    }
    return id
  }

  // 2. Load Event Info & Calculate Remaining Photos
  useEffect(() => {
    async function loadEvent() {
      const { data: event } = await supabase.from("events").select("*").eq("id", params.eventId).single()
      if (event) {
        setEventData(event)
        const { count } = await supabase.from("photos")
          .select("id", { count: "exact" })
          .eq("event_id", params.eventId)
        setRemainingPhotos(event.photo_limit - (count || 0))
      }
    }
    loadEvent()
  }, [params.eventId])

  const switchCamera = async () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    setIsStreaming(false)
    await new Promise(r => setTimeout(r, 150))
    setFacingMode(prev => prev === "user" ? "environment" : "user")
  }

  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode } })
        streamRef.current = s
        if (videoRef.current) videoRef.current.srcObject = s
        setIsStreaming(true)
      } catch { setError("Please allow camera access in your browser settings.") }
    }
    startCamera()
    return () => streamRef.current?.getTracks().forEach(t => t.stop())
  }, [facingMode])

  // 3. The "Filing Cabinet" Capture Logic
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing || remainingPhotos <= 0) return

    setIsCapturing(true)
    const canvas = canvasRef.current
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    ctx.drawImage(videoRef.current, 0, 0)
    const imageData = canvas.toDataURL("image/jpeg", 0.8)

    // --- STEP A: SAVE TO PHONE STORAGE ---
    const link = document.createElement("a")
    link.href = imageData
    link.download = `momento-${Date.now()}.jpg`
    link.click() 

    // --- STEP B: UPLOAD TO SUPABASE FOLDER ---
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const guestId = getGuestId()
      const fileName = `${Date.now()}.jpg`
      // PATH: EventID / GuestID / FileName
      const filePath = `${params.eventId}/${guestId}/${fileName}`

      const { error: upErr } = await supabase.storage.from("photos").upload(filePath, blob)
      
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(filePath)
        await supabase.from("photos").insert([{ 
          event_id: params.eventId, 
          url: publicUrl, 
          guest_id: guestId,
          storage_path: filePath 
        }])
        setLastPhotoUrl(publicUrl)
        setRemainingPhotos(prev => prev - 1)
        setShowDownload(true)
      }
      setIsCapturing(false)
    }, "image/jpeg")
  }

  if (error) return <div className="p-20 text-white text-center font-mono">{error}</div>

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center p-4 font-mono text-amber-100">
      <div className="w-full max-w-md flex justify-between mb-4 px-2 text-[10px] uppercase tracking-widest opacity-70">
        <span>{eventData?.name || "Initializing..."}</span>
        <span className={remainingPhotos < 5 ? "text-red-500 animate-pulse font-bold" : ""}>
          {remainingPhotos} EXPOSURES LEFT
        </span>
      </div>

      <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-3xl overflow-hidden border-8 border-stone-800 shadow-2xl">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        
        {showDownload && (
          <div className="absolute inset-0 bg-stone-900/95 z-30 flex flex-col items-center justify-center p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-xl mb-2 tracking-tighter">SAVED TO GALLERY</h2>
            <p className="text-[10px] text-stone-500 mb-8 uppercase">A copy has been sent to the event vault</p>
            <button onClick={() => setShowDownload(false)} className="bg-amber-600 text-black px-12 py-4 rounded-full font-bold text-sm active:scale-95 transition-all">
              NEXT PHOTO
            </button>
          </div>
        )}

        <button onClick={switchCamera} className="absolute top-4 right-4 z-20 bg-black/40 p-3 rounded-full border border-white/10 backdrop-blur-md">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <button 
        onClick={capturePhoto}
        disabled={isCapturing || remainingPhotos <= 0}
        className={`mt-10 w-24 h-24 rounded-full border-[10px] border-stone-700 transition-all ${isCapturing ? 'bg-red-500' : 'bg-white active:scale-90 shadow-[0_0_20px_rgba(255,255,255,0.3)]'}`}
      />
      
      <canvas ref={canvasRef} className="hidden" />
      <p className="mt-6 text-stone-600 text-[10px] uppercase tracking-[0.2em]">
        {isCapturing ? "Developing..." : "Tap to Snap"}
      </p>
    </div>
  )
}
