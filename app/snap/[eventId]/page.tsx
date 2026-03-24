"use client"

import { useState, useRef, useEffect } from "react"
import { RefreshCw, Download, Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function SnapPage({ params }: { params: { eventId: string } }) {
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [lastPhotoUrl, setLastPhotoUrl] = useState<string | null>(null)
  const [showDownload, setShowDownload] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 1. Camera Control
  const switchCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsStreaming(false)
    await new Promise((resolve) => setTimeout(resolve, 150))
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
  }

  useEffect(() => {
    async function startCamera() {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode }
        })
        streamRef.current = newStream
        if (videoRef.current) videoRef.current.srcObject = newStream
        setIsStreaming(true)
      } catch (err) {
        setError("Camera access denied.")
      }
    }
    startCamera()
    return () => streamRef.current?.getTracks().forEach(t => t.stop())
  }, [facingMode])

  // 2. THE FILING CABINET LOGIC (Capture & Upload)
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return

    setIsCapturing(true)
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    const context = canvas.getContext("2d")
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      canvas.toBlob(async (blob) => {
        if (!blob) return

        // --- FOLDER LOGIC STARTS HERE ---
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
        const filePath = `${params.eventId}/${fileName}` // Folder = Event ID
        // --------------------------------

        // 1. Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("photos")
          .upload(filePath, blob)

        if (uploadError) {
          console.error("Upload failed:", uploadError)
          setIsCapturing(false)
          return
        }

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from("photos")
          .getPublicUrl(filePath)

        // 3. Save to Database
        await supabase.from("photos").insert([
          {
            event_id: params.eventId,
            url: publicUrl,
            storage_path: filePath // Keeping path for easy folder-based fetching
          }
        ])

        setLastPhotoUrl(publicUrl)
        setShowDownload(true)
        setIsCapturing(false)
      }, "image/jpeg", 0.8)
    }
  }

  if (error) return <div className="p-20 text-white">{error}</div>

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center p-4">
      <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-3xl overflow-hidden border-8 border-stone-800 shadow-2xl">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        
        {/* Switch Button */}
        <button onClick={switchCamera} className="absolute top-4 right-4 z-20 bg-black/40 p-3 rounded-full border border-white/20">
          <RefreshCw className="w-6 h-6 text-white" />
        </button>

        {/* Capture Preview Overlay */}
        {showDownload && lastPhotoUrl && (
          <div className="absolute inset-0 bg-black/90 z-30 flex flex-col items-center justify-center p-6 text-center">
            <img src={lastPhotoUrl} className="max-h-64 rounded-lg border-2 border-amber-500 mb-4" alt="Captured" />
            <div className="flex gap-4">
              <button onClick={() => setShowDownload(false)} className="bg-stone-700 text-white px-6 py-2 rounded-full font-mono">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Shutter Button */}
      <button 
        onClick={capturePhoto}
        disabled={isCapturing}
        className={`mt-8 w-24 h-24 rounded-full border-8 border-stone-500 transition-all ${isCapturing ? 'bg-red-500 scale-90' : 'bg-white active:scale-90'}`}
      />
      
      <canvas ref={canvasRef} className="hidden" />
      <p className="mt-4 text-stone-500 font-mono text-xs uppercase tracking-widest">
        {isCapturing ? "Processing..." : "Tap to Capture"}
      </p>
    </div>
  )
}
