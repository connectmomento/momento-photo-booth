"use client"

import { useState, useRef, useEffect } from "react"
import { Camera, RefreshCw, Download } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function SnapPage({ params }: { params: { eventId: string } }) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [lastPhotoUrl, setLastPhotoUrl] = useState<string | null>(null)
  const [showDownload, setShowDownload] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 1. FIX: The Switch Camera Logic
  const switchCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsStreaming(false)
    
    // Tiny pause for hardware
    await new Promise((resolve) => setTimeout(resolve, 150))
    
    // Toggle mode
    const newMode = facingMode === "user" ? "environment" : "user"
    setFacingMode(newMode)
  }

  // 2. Camera Initialization
  useEffect(() => {
    async function startCamera() {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
        }
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode }
        })
        streamRef.current = newStream
        if (videoRef.current) {
          videoRef.current.srcObject = newStream
        }
        setIsStreaming(true)
        setError(null)
      } catch (err) {
        console.error("Camera Error:", err)
        setError("Camera access denied. Please allow permissions.")
      }
    }
    startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [facingMode])

  // 3. UI Rendering (The logic that was erroring out)
  if (error) {
    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-stone-800 border-2 border-red-500 rounded-lg p-8">
          <p className="text-red-400 font-mono mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-amber-600 text-stone-900 px-4 py-2 rounded font-bold"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center p-4">
      <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-3xl overflow-hidden border-8 border-stone-800 shadow-2xl">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        
        {/* Switch Button */}
        <button 
          onClick={switchCamera}
          className="absolute top-4 right-4 z-20 bg-stone-900/50 p-3 rounded-full border border-white/20"
        >
          <RefreshCw className="w-6 h-6 text-white" />
        </button>
      </div>

      <button className="mt-8 w-20 h-20 rounded-full bg-white border-8 border-stone-400 active:scale-95 transition-transform" />
      <p className="mt-4 text-stone-500 font-mono text-xs uppercase tracking-widest">Single Use Camera</p>
    </div>
  )
}
