"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Camera, Users, Image as ImageIcon, QrCode, ArrowLeft } from "lucide-react"
import { StatCard } from "@/components/stat-card"
import { ProgressSection } from "@/components/progress-section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { QRCodeCanvas } from "qrcode.react"
import Link from "next/link"

interface EventData {
  id: string
  name: string
  description: string | null
  date: string | null
  photo_limit: number
  is_active: boolean
}

export default function EventHostDashboard() {
  const params = useParams()
  const eventId = params.eventId as string
  
  const [event, setEvent] = useState<EventData | null>(null)
  const [stats, setStats] = useState({ totalPhotos: 0, totalGuests: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [eventNotFound, setEventNotFound] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  const snapUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/snap/${eventId}` 
    : `/snap/${eventId}`

  const fetchEvent = useCallback(async () => {
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
    
    setEvent(data)
  }, [eventId, supabase])

  const fetchStats = useCallback(async () => {
    const [photosResult, guestsResult] = await Promise.all([
      supabase.from("photos").select("*", { count: "exact", head: true }).eq("event_id", eventId),
      supabase.from("guests").select("*", { count: "exact", head: true }).eq("event_id", eventId),
    ])

    setStats({
      totalPhotos: photosResult.count || 0,
      totalGuests: guestsResult.count || 0,
    })
    setIsLoading(false)
  }, [eventId, supabase])

  useEffect(() => {
    fetchEvent()
    fetchStats()

    // Real-time subscription for photo updates
    const photosChannel = supabase
      .channel(`realtime-photos-${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "photos", filter: `event_id=eq.${eventId}` },
        () => {
          fetchStats()
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "photos", filter: `event_id=eq.${eventId}` },
        () => {
          fetchStats()
        }
      )
      .subscribe()

    // Real-time subscription for guest updates
    const guestsChannel = supabase
      .channel(`realtime-guests-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guests", filter: `event_id=eq.${eventId}` },
        () => {
          fetchStats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(photosChannel)
      supabase.removeChannel(guestsChannel)
    }
  }, [eventId, supabase, fetchEvent, fetchStats])

  const estimatedStorage = `~${Math.round((stats.totalPhotos * 1.8))} MB`
  const photoGoal = event ? event.photo_limit * 100 : 2500

  if (eventNotFound) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <Camera className="w-16 h-16 mx-auto text-stone-600 mb-4" />
          <h1 className="text-2xl font-bold text-stone-300 mb-2">Event Not Found</h1>
          <p className="text-stone-500 mb-6">This event does not exist.</p>
          <Link href="/">
            <Button className="bg-amber-600 hover:bg-amber-500 text-stone-900">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950 p-8 font-sans">
      {/* Header Section */}
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
        <div>
          <Link 
            href="/" 
            className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Events
          </Link>
          <h1 className="text-3xl font-bold text-amber-100 tracking-tight text-balance">
            {event?.name || "Loading..."}
          </h1>
          <p className="text-stone-400">
            {event?.description || "Live monitoring dashboard"}
          </p>
          {event?.date && (
            <p className="text-stone-500 text-sm mt-1">
              {new Date(event.date).toLocaleDateString("en-US", { 
                weekday: "long", 
                year: "numeric", 
                month: "long", 
                day: "numeric" 
              })}
            </p>
          )}
        </div>
        <Button 
          className="flex items-center gap-2 rounded-full px-6 bg-amber-600 hover:bg-amber-500 text-stone-900"
          onClick={() => setQrModalOpen(true)}
        >
          <QrCode size={20} />
          View Event QR Code
        </Button>
      </header>

      {/* Stats Grid */}
      <main className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatCard
            icon={<ImageIcon className="text-amber-400" size={24} />}
            label="Total Photos Captured"
            value={isLoading ? "..." : stats.totalPhotos.toLocaleString()}
            subtext={`Goal: ${photoGoal.toLocaleString()}`}
          />
          <StatCard
            icon={<Users className="text-emerald-400" size={24} />}
            label="Active Guests"
            value={isLoading ? "..." : stats.totalGuests.toLocaleString()}
            subtext={`${event?.photo_limit || 25} photos per guest`}
          />
          <StatCard
            icon={<Camera className="text-sky-400" size={24} />}
            label="Storage Used"
            value={isLoading ? "..." : estimatedStorage}
            subtext="Estimated based on avg size"
          />
        </div>

        {/* Progress Bar */}
        <ProgressSection
          currentValue={stats.totalPhotos}
          maxValue={photoGoal}
          label="of photo goal reached"
        />

        {/* Status Badge */}
        {event && (
          <div className="mt-8 flex justify-center">
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                event.is_active
                  ? "bg-green-900/30 text-green-400 border border-green-800"
                  : "bg-stone-800 text-stone-500 border border-stone-700"
              }`}
            >
              {event.is_active ? "Event is Live" : "Event is Inactive"}
            </span>
          </div>
        )}
      </main>

      {/* QR Code Modal */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="sm:max-w-md bg-stone-900 border-stone-700 text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-amber-100">Event Camera QR Code</DialogTitle>
            <DialogDescription className="text-stone-400">
              Guests can scan this code to access the camera
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="bg-white p-4 rounded-lg">
              <QRCodeCanvas 
                value={snapUrl} 
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="text-sm text-stone-400 text-center break-all px-4">
              {snapUrl}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
