"use client"

import { useState, useRef, useEffect } from "react"
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function SnapPage({ params }: { params: { eventId: string } }) {
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [isCapturing, setIsCapturing] = useState(false)
  const [showDownload, setShowDownload] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Initialize with a fallback so it doesn't show 0 immediately
  const [remainingPhotos, setRemainingPhotos] = useState<number | null>(null)
  const [eventData, setEventData] = useState<any>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const getGuestId = () => {
    let id = localStorage.getItem(`guest_${params.eventId}`)
    if (!id) {
      id = `g_${Math.random().toString(36).substring(7)}`
      localStorage.setItem(`guest_${params.eventId}`, id)
    }
    return id
  }

  // 1. Improved Data Loading
  useEffect(() => {
    async function loadEvent() {
      try {
        const { data: event, error: eventErr } = await supabase
          .from("events")
          .select("*")
          .eq("id", params.eventId)
          .single()

        if (eventErr || !event) {
          setError("Event not found")
          return
        }

        setEventData(event)

        const { count, error: countErr } = await supabase
          .from("photos")
          .select("id", { count: "exact" })
          .eq("event_id", params.eventId)

        const limit = event.photo_limit || 25
        setRemainingPhotos(limit - (count || 0))
      } catch (err) {
        console.error(err)
        setRemainingPhotos(25) // Fallback
      }
    }
    loadEvent()
  }, [params.eventId])

  // 2. Fixed Camera Switching (Cleans up old streams properly)
  const stopGui = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const startCamera = async () => {
    stopGui()
    try {
      const constraints = {
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      setError("Camera access denied. Please check site permissions.")
    }
  }

  useEffect(() => {
    startCamera()
    return () => stopGui()
  }, [facingMode])

  const switchCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user")
  }

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

    // Save locally
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
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-10 text-center font-mono">
      <AlertCircle className="text-red-500 w-12 h-12 mb-4" />
      <p className="text-white">{error}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center p-4 font-mono text-amber-100">
      <div className="w-full max-w-md flex justify-between mb-4 px-2 text-[10px] tracking-widest uppercase opacity-70">
        <span>{eventData?.name || "Initializing..."}</span>
        <span>{remainingPhotos ?? "--"} EXPOSURES LEFT</span>
      </div>

      <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-3xl overflow-hidden border-8 border-stone-800 shadow-2xl">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        
        {showDownload && (
          <div className="absolute inset-0 bg-stone-900/95 z-30 flex flex-col items-center justify-center p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-xl mb-6">SAVED TO GALLERY</h2>
            <button onClick={() => setShowDownload(false)} className="bg-amber-600 text-black px-12 py-4 rounded-full font-bold">NEXT SNAP</button>
          </div>
        )}

        <button onClick={switchCamera} className="absolute top-4 right-4 z-20 bg-black/40 p-3 rounded-full border border-white/10">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <button 
        onClick={capturePhoto}
        disabled={isCapturing || (remainingPhotos !== null && remainingPhotos <= 0)}
        className={`mt-10 w-24 h-24 rounded-full border-[10px] border-stone-700 ${isCapturing ? 'bg-red-500' : 'bg-white active:scale-90'}`}
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
