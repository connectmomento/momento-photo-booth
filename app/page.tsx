"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Camera, Users, Image as ImageIcon, Plus, Settings, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

interface EventWithStats {
  id: string
  name: string
  description: string | null
  date: string | null
  photo_limit: number
  is_active: boolean
  created_at: string
  photo_count: number
  guest_count: number
}

export default function HomePage() {
  const supabase = useMemo(() => createClient(), [])
  
  const [events, setEvents] = useState<EventWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalPhotos, setTotalPhotos] = useState(0)
  const [totalGuests, setTotalGuests] = useState(0)

  const fetchData = useCallback(async () => {
    // Fetch all events
    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
    
    if (error) {
      console.error("Error fetching events:", error)
      setIsLoading(false)
      return
    }
    
    // Fetch counts for each event
    const eventsWithCounts = await Promise.all(
      (eventsData || []).map(async (event) => {
        const [photosResult, guestsResult] = await Promise.all([
          supabase.from("photos").select("id", { count: "exact" }).eq("event_id", event.id),
          supabase.from("guests").select("id", { count: "exact" }).eq("event_id", event.id),
        ])
        
        return {
          ...event,
          photo_count: photosResult.count || 0,
          guest_count: guestsResult.count || 0,
        }
      })
    )
    
    // Calculate totals
    const photos = eventsWithCounts.reduce((sum, e) => sum + e.photo_count, 0)
    const guests = eventsWithCounts.reduce((sum, e) => sum + e.guest_count, 0)
    
    setEvents(eventsWithCounts)
    setTotalPhotos(photos)
    setTotalGuests(guests)
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
    
    // Set up realtime subscriptions
    const photosChannel = supabase
      .channel("realtime-all-photos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "photos" },
        () => fetchData()
      )
      .subscribe()

    const eventsChannel = supabase
      .channel("realtime-events")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(photosChannel)
      supabase.removeChannel(eventsChannel)
    }
  }, [supabase, fetchData])

  const activeEvents = events.filter((e) => e.is_active)

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-amber-100">Photo Booth Platform</h1>
            <p className="text-stone-400 text-sm">Multi-event management dashboard</p>
          </div>
          
          <Link href="/admin">
            <Button variant="outline" className="border-stone-600 text-stone-300 hover:bg-stone-800">
              <Settings className="w-4 h-4 mr-2" />
              Admin
            </Button>
          </Link>
        </div>
      </header>

      {/* Summary Stats */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-stone-900 border border-stone-800 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-2">
              <ImageIcon className="w-5 h-5 text-amber-400" />
              <span className="text-stone-400 text-sm">Total Photos</span>
            </div>
            <p className="text-3xl font-bold text-amber-100">
              {isLoading ? "..." : totalPhotos.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-stone-900 border border-stone-800 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span className="text-stone-400 text-sm">Total Guests</span>
            </div>
            <p className="text-3xl font-bold text-emerald-100">
              {isLoading ? "..." : totalGuests.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-stone-900 border border-stone-800 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-2">
              <Camera className="w-5 h-5 text-sky-400" />
              <span className="text-stone-400 text-sm">Active Events</span>
            </div>
            <p className="text-3xl font-bold text-sky-100">
              {isLoading ? "..." : activeEvents.length}
            </p>
          </div>
        </div>

        {/* Events Section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-stone-200">Your Events</h2>
          <Link href="/admin">
            <Button className="bg-amber-600 hover:bg-amber-500 text-stone-900">
              <Plus className="w-4 h-4 mr-2" />
              New Event
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <p className="text-stone-500">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 bg-stone-900 border border-stone-800 rounded-lg">
            <Camera className="w-16 h-16 mx-auto text-stone-600 mb-4" />
            <h3 className="text-xl font-medium text-stone-400 mb-2">No events yet</h3>
            <p className="text-stone-500 mb-6">Create your first event to get started</p>
            <Link href="/admin">
              <Button className="bg-amber-600 hover:bg-amber-500 text-stone-900">
                <Plus className="w-4 h-4 mr-2" />
                Create Event
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Link key={event.id} href={`/event/${event.id}`}>
                <Card
                  className={`bg-stone-900 border-stone-800 hover:border-amber-600/50 transition-colors cursor-pointer h-full ${
                    !event.is_active ? "opacity-60" : ""
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-amber-100 truncate">{event.name}</CardTitle>
                        {event.description && (
                          <CardDescription className="text-stone-400 truncate">
                            {event.description}
                          </CardDescription>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ml-2 ${
                          event.is_active
                            ? "bg-green-900/50 text-green-400 border border-green-800"
                            : "bg-stone-800 text-stone-500 border border-stone-700"
                        }`}
                      >
                        {event.is_active ? "Live" : "Inactive"}
                      </span>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {/* Stats */}
                    <div className="flex gap-4 mb-3">
                      <div className="flex items-center gap-2 text-stone-400">
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-sm">{event.photo_count} photos</span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-400">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">{event.guest_count} guests</span>
                      </div>
                    </div>
                    
                    {/* Date */}
                    {event.date && (
                      <p className="text-sm text-stone-500">
                        {new Date(event.date).toLocaleDateString()}
                      </p>
                    )}
                    
                    {/* View link hint */}
                    <div className="flex items-center gap-1 text-amber-400 text-sm mt-3">
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Dashboard
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
