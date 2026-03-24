"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { RefreshCw, Download, Camera } from "lucide-react"

const DEFAULT_MAX_PHOTOS = 25

function generateGuestId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function getGuestData(eventId: string): { guestId: string; photoCount: number } {
  if (typeof window === "undefined") {
    return { guestId: "", photoCount: 0 }
  }
  
  const storageKey = `guest_${eventId}`
  let guestId = localStorage.getItem(`${storageKey}_id`)
  if (!guestId) {
    guestId = generateGuestId()
    localStorage.setItem(`${storageKey}_id`, guestId)
    localStorage.setItem(`${storageKey}_count`, "0")
  }
  
  const photoCount = parseInt(localStorage.getItem(`${storageKey}_count`) || "0", 10)
  return { guestId, photoCount }
}

type FacingMode = "user" | "environment"

interface EventData {
  id: string
  name: string
  photo_limit: number
  is_active: boolean
}

export default function SnapPage() {
  const params = useParams()
  const eventId = params.eventId as string
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  
  const [isStreaming, setIsStreaming] = useState(false)
  const [photoCount, setPhotoCount] = useState(0)
  const [guestId, setGuestId] = useState("")
  const [isCapturing, setIsCapturing] = useState(false)
  const [flashActive, setFlashActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [facingMode, setFacingMode] = useState<FacingMode>("environment")
  const [lastPhotoUrl, setLastPhotoUrl] = useState<string | null>(null)
  const [showDownload, setShowDownload] = useState(false)
  const [event, setEvent] = useState<EventData | null>(null)
  const [eventNotFound, setEventNotFound] = useState(false)
  
  const supabase = createClient()
  
  const maxPhotos = event?.photo_limit ?? DEFAULT_MAX_PHOTOS
  const remainingPhotos = maxPhotos - photoCount
  const isOutOfFilm = remainingPhotos <= 0

  // Fetch event data
  useEffect(() => {
    async function fetchEvent() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single()
      
      if (error || !data) {
        setEventNotFound(true)
        setIsLoading(false)
        return
      }
      
      if (!data.is_active) {
        setEventNotFound(true)
        setIsLoading(false)
        return
      }
      
      setEvent(data)
      
      const { guestId: id, photoCount: count } = getGuestData(eventId)
      setGuestId(id)
      setPhotoCount(count)
      setIsLoading(false)
    }
    
    fetchEvent()
  }, [eventId, supabase])

  const startCamera = useCallback(async (facing: FacingMode) => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsStreaming(true)
        setError(null)
      }
    } catch (err) {
      setError("Camera access denied. Please allow camera permissions.")
      console.error("Camera error:", err)
    }
  }, [])

  useEffect(() => {
    if (!isOutOfFilm && !isLoading && event) {
      startCamera(facingMode)
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isOutOfFilm, isLoading, event, facingMode, startCamera])

 const switchCamera = async () => {
    // 1. Stop all current camera tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    
    setIsStreaming(false)

    // 2. A tiny 150ms pause to let the phone hardware reset
    await new Promise((resolve) => setTimeout(resolve, 150))

    // 3. FLIP: Switch between 'user' (front) and 'environment' (back)
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
    
    // 4. RESTART: The camera will automatically restart because facingMode changed
  }
        
    const newMode = facingMode === "user" ? "environment" : "user"
    setFacingMode(newMode)
    
    // Give hardware a moment to reset before starting new camera
    await new Promise((resolve) => setTimeout(resolve, 100))
    
    await startCamera(newMode)
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing || isOutOfFilm) return

    setIsCapturing(true)
    setFlashActive(true)
    setShowDownload(false)

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Mirror the image if using front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }

    // Draw the video frame
    ctx.drawImage(video, 0, 0)

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    // Apply grain effect
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 50
      data[i] = Math.min(255, Math.max(0, data[i] + noise))
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise))
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise))
    }
    ctx.putImageData(imageData, 0, 0)

    // Store data URL for download
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
    setLastPhotoUrl(dataUrl)

    // Convert to blob and upload
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setIsCapturing(false)
        setFlashActive(false)
        return
      }

      // Store in event subfolder: eventId/guestId/timestamp.jpg
      const fileName = `${eventId}/${guestId}/${Date.now()}.jpg`

      try {
        const { error: uploadError } = await supabase.storage
          .from("photos")
          .upload(fileName, blob, { contentType: "image/jpeg" })

        if (uploadError) throw uploadError

        // Get the public URL
        const { data: urlData } = supabase.storage.from("photos").getPublicUrl(fileName)

        // Insert into photos table with event_id
        await supabase.from("photos").insert({
          guest_id: guestId,
          event_id: eventId,
          url: urlData.publicUrl,
          size_bytes: blob.size,
        })

        // Update local storage and state
        const storageKey = `guest_${eventId}`
        const newCount = photoCount + 1
        localStorage.setItem(`${storageKey}_count`, newCount.toString())
        setPhotoCount(newCount)
        setShowDownload(true)
      } catch (err) {
        console.error("Upload error:", err)
        setError("Failed to upload photo. Try again!")
      }

      setTimeout(() => {
        setFlashActive(false)
        setIsCapturing(false)
      }, 200)
    }, "image/jpeg", 0.85)
  }

  const downloadPhoto = () => {
    if (!lastPhotoUrl) return
    
    const link = document.createElement("a")
    link.href = lastPhotoUrl
    link.download = `photo_${Date.now()}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const dismissDownload = () => {
    setShowDownload(false)
    setLastPhotoUrl(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <div className="text-amber-100 font-mono">Loading camera...</div>
      </div>
    )
  }

  if (eventNotFound) {
    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-6">
        <div className="bg-stone-800 border-4 border-red-600 rounded-lg p-8 max-w-sm text-center shadow-2xl">
          <Camera className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h1 className="text-2xl font-bold text-red-100 font-mono mb-2">
            Event Not Found
          </h1>
          <p className="text-red-200/70 font-mono text-sm">
            This event does not exist or is no longer active.
          </p>
        </div>
      </div>
    )
  }

  if (isOutOfFilm) {
    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-6">
        <div className="bg-stone-800 border-4 border-amber-600 rounded-lg p-8 max-w-sm text-center shadow-2xl">
          <Camera className="w-16 h-16 mx-auto mb-4 text-amber-400" />
          <h1 className="text-2xl font-bold text-amber-100 font-mono mb-2">
            {"You've used up your film!"}
          </h1>
          <p className="text-amber-200/70 font-mono text-sm mb-4">
            All {maxPhotos} exposures taken
          </p>
          <div className="bg-stone-700 rounded p-3">
            <p className="text-amber-100/60 font-mono text-xs">
              Thanks for capturing memories at {event?.name}!
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col">
      {/* Camera Body */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Event name */}
        {event && (
          <div className="mb-4 text-center">
            <h1 className="text-amber-100 font-mono text-lg tracking-wider">{event.name}</h1>
          </div>
        )}
        
        {/* Viewfinder Frame */}
        <div className="relative w-full max-w-md aspect-[3/4] bg-stone-950 rounded-lg overflow-hidden border-8 border-stone-700 shadow-2xl">
          {/* Top camera details */}
          <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-stone-800 to-transparent p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-amber-100/80 font-mono text-xs uppercase tracking-wider">
                Disposable
              </span>
            </div>
            <div className="bg-stone-900/80 px-2 py-1 rounded border border-amber-600/50">
              <span className="text-amber-400 font-mono text-sm font-bold">
                {remainingPhotos}
              </span>
              <span className="text-amber-100/60 font-mono text-xs"> left</span>
            </div>
          </div>

          {/* Switch camera button */}
          <button
            onClick={switchCamera}
            className="absolute top-14 right-3 z-20 bg-stone-800/80 hover:bg-stone-700 p-2 rounded-full border border-amber-600/30 transition-colors"
            aria-label="Switch camera"
          >
            <RefreshCw className="w-5 h-5 text-amber-400" />
          </button>

          {/* Video viewfinder */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
          />

          {/* Grain overlay */}
          <div 
            className="absolute inset-0 pointer-events-none z-10 opacity-30 mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Vignette effect */}
          <div 
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.6) 100%)",
            }}
          />

          {/* Flash effect */}
          {flashActive && (
            <div className="absolute inset-0 bg-white z-30 animate-pulse" />
          )}

          {/* Viewfinder corners */}
          <div className="absolute top-6 left-6 w-8 h-8 border-l-2 border-t-2 border-amber-400/50 z-20" />
          <div className="absolute top-6 right-6 w-8 h-8 border-r-2 border-t-2 border-amber-400/50 z-20" />
          <div className="absolute bottom-6 left-6 w-8 h-8 border-l-2 border-b-2 border-amber-400/50 z-20" />
          <div className="absolute bottom-6 right-6 w-8 h-8 border-r-2 border-b-2 border-amber-400/50 z-20" />

          {/* Download overlay */}
          {showDownload && lastPhotoUrl && (
            <div className="absolute inset-0 bg-stone-900/95 z-25 flex flex-col items-center justify-center p-6">
              <img 
                src={lastPhotoUrl} 
                alt="Captured photo" 
                className="max-w-full max-h-48 rounded-lg border-2 border-amber-600 mb-4"
              />
              <p className="text-amber-100 font-mono text-sm mb-4">Photo captured!</p>
              <div className="flex gap-3">
                <button
                  onClick={downloadPhoto}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-stone-900 font-mono text-sm px-4 py-2 rounded transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={dismissDownload}
                  className="bg-stone-700 hover:bg-stone-600 text-amber-100 font-mono text-sm px-4 py-2 rounded transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-900/90 z-20">
              <div className="text-center p-4">
                <p className="text-red-400 font-mono text-sm mb-4">{error}</p>
                <button
                  onClick={() => startCamera(facingMode)}
                  className="bg-amber-600 text-stone-900 font-mono text-sm px-4 py-2 rounded hover:bg-amber-500 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Film counter strip */}
        <div className="mt-4 flex items-center gap-1 flex-wrap justify-center max-w-md">
          {Array.from({ length: maxPhotos }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-3 rounded-sm transition-colors ${
                i < photoCount ? "bg-stone-600" : "bg-amber-500"
              }`}
            />
          ))}
        </div>

        {/* Shutter Button */}
        <div className="mt-6">
          <button
            onClick={capturePhoto}
            disabled={!isStreaming || isCapturing || showDownload}
            className="relative group"
          >
            {/* Outer ring */}
            <div className="w-20 h-20 rounded-full bg-stone-700 border-4 border-stone-600 flex items-center justify-center shadow-lg transition-transform group-active:scale-95">
              {/* Inner button */}
              <div 
                className={`w-14 h-14 rounded-full transition-all ${
                  isCapturing 
                    ? "bg-amber-400 scale-90" 
                    : "bg-amber-500 group-hover:bg-amber-400"
                } shadow-inner`}
              />
            </div>
            {/* Label */}
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-amber-100/60 font-mono text-xs uppercase tracking-widest">
              Snap
            </span>
          </button>
        </div>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom brand */}
      <div className="pb-6 text-center">
        <p className="text-stone-600 font-mono text-xs tracking-widest uppercase">
          Single Use Camera
        </p>
      </div>
    </div>
  )
}
