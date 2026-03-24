"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Calendar, Camera, Users, Trash2, QrCode, Copy, Check, ExternalLink } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

interface Event {
  id: string
  name: string
  description: string | null
  date?: string | null
  event_date?: string | null
  photo_limit: number
  is_active: boolean
  created_at: string
  photo_count?: number
  guest_count?: number
}

export default function AdminDashboard() {
  const supabase = useMemo(() => createClient(), [])
  
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [copied, setCopied] = useState(false)
  
  // Form state
  const [newEvent, setNewEvent] = useState({
    name: "",
    description: "",
    date: "",
    photo_limit: 25,
  })

  const fetchEvents = useCallback(async () => {
    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
    
    if (error) {
      console.error("Error fetching events:", error)
      return
    }
    
    // Fetch photo and guest counts for each event
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
    
    setEvents(eventsWithCounts)
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleCreateEvent = async () => {
    if (!newEvent.name.trim()) return
    
    try {
      // Build insert object - only include date if provided
      const insertData: Record<string, unknown> = {
        name: newEvent.name,
        description: newEvent.description || null,
        photo_limit: newEvent.photo_limit,
        is_active: true,
      }
      
      // Only add event_date if user provided a date
      if (newEvent.date) {
        insertData.event_date = newEvent.date
      }
      
      console.log("[v0] Attempting insert with data:", insertData)
      
      const { data, error } = await supabase
        .from("events")
        .insert(insertData)
        .select()
      
      console.log("[v0] Insert Result:", data, error)
      
      if (error) {
        console.error("[v0] Error creating event:", error)
        return
      }
      
      // Reset form and close modal
      setNewEvent({ name: "", description: "", date: "", photo_limit: 25 })
      setIsCreateOpen(false)
      
      // Refresh events list
      fetchEvents()
    } catch (err) {
      console.error("[v0] Unexpected error:", err)
    }
  }

  const toggleEventActive = async (event: Event) => {
    const { error } = await supabase
      .from("events")
      .update({ is_active: !event.is_active })
      .eq("id", event.id)
    
    if (error) {
      console.error("Error updating event:", error)
      return
    }
    
    fetchEvents()
  }

  const deleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event? All photos will be lost.")) return
    
    const { error } = await supabase.from("events").delete().eq("id", eventId)
    
    if (error) {
      console.error("Error deleting event:", error)
      return
    }
    
    fetchEvents()
  }

  const showQrCode = (event: Event) => {
    setSelectedEvent(event)
    setIsQrOpen(true)
    setCopied(false)
  }

  const getEventUrl = (eventId: string) => {
    // We hardcode your main domain here so the QR code is always 'clean' 
    // and points to the production site, not the private preview links.
    return `https://project-04vwo.vercel.app/snap/${eventId}`
  }

  const copyEventUrl = () => {
    if (!selectedEvent) return
    navigator.clipboard.writeText(getEventUrl(selectedEvent.id))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-amber-100 font-mono">Loading events...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-amber-100">Admin Dashboard</h1>
            <p className="text-stone-400 text-sm">Manage your photo booth events</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-500 text-stone-900 font-medium">
                <Plus className="w-4 h-4 mr-2" />
                New Event
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-stone-900 border-stone-700 text-stone-100">
              <DialogHeader>
                <DialogTitle className="text-amber-100">Create New Event</DialogTitle>
                <DialogDescription className="text-stone-400">
                  Set up a new photo booth event for your guests.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium text-stone-300 mb-1.5 block">
                    Event Name *
                  </label>
                  <Input
                    placeholder="e.g., Sarah's Wedding"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                    className="bg-stone-800 border-stone-700 text-stone-100 placeholder:text-stone-500"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-stone-300 mb-1.5 block">
                    Description
                  </label>
                  <Input
                    placeholder="Optional description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="bg-stone-800 border-stone-700 text-stone-100 placeholder:text-stone-500"
                  />
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-stone-300 mb-1.5 block">
                      Event Date
                    </label>
                    <Input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="bg-stone-800 border-stone-700 text-stone-100"
                    />
                  </div>
                  
                  <div className="w-32">
                    <label className="text-sm font-medium text-stone-300 mb-1.5 block">
                      Photo Limit
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={newEvent.photo_limit}
                      onChange={(e) => setNewEvent({ ...newEvent, photo_limit: parseInt(e.target.value) || 25 })}
                      className="bg-stone-800 border-stone-700 text-stone-100"
                    />
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="border-stone-600 text-stone-300 hover:bg-stone-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateEvent}
                  disabled={!newEvent.name.trim()}
                  className="bg-amber-600 hover:bg-amber-500 text-stone-900"
                >
                  Create Event
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {events.length === 0 ? (
          <div className="text-center py-16">
            <Camera className="w-16 h-16 mx-auto text-stone-600 mb-4" />
            <h2 className="text-xl font-medium text-stone-400 mb-2">No events yet</h2>
            <p className="text-stone-500 mb-6">Create your first event to get started</p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-amber-600 hover:bg-amber-500 text-stone-900"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Event
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Card
                key={event.id}
                className={`bg-stone-900 border-stone-800 ${!event.is_active ? "opacity-60" : ""}`}
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
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        event.is_active
                          ? "bg-green-900/50 text-green-400 border border-green-800"
                          : "bg-stone-800 text-stone-500 border border-stone-700"
                      }`}
                    >
                      {event.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-stone-400">
                      <Camera className="w-4 h-4" />
                      <span className="text-sm">{event.photo_count} photos</span>
                    </div>
                    <div className="flex items-center gap-2 text-stone-400">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">{event.guest_count} guests</span>
                    </div>
                  </div>
                  
                  {/* Date & Limit */}
                  <div className="flex gap-4 text-sm text-stone-500">
                    {(event.event_date || event.date) && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(event.event_date || event.date || "").toLocaleDateString()}
                      </div>
                    )}
                    <div>Limit: {event.photo_limit} per guest</div>
                  </div>
                  
                  {/* Actions */}
<div className="flex flex-col gap-2 pt-2">
  <div className="flex gap-2">
    <Button
      size="sm"
      variant="outline"
      onClick={() => showQrCode(event)}
      className="flex-1 border-amber-600/50 text-amber-400 hover:bg-amber-600/10"
    >
      <QrCode className="w-4 h-4 mr-1.5" />
      QR Code
    </Button>
    
    {/* NEW VIEW GALLERY BUTTON */}
    <a 
      href={`/event/${event.id}`} 
      className="flex-1"
    >
      <Button
        size="sm"
        variant="outline"
        className="w-full border-blue-600/50 text-blue-400 hover:bg-blue-600/10"
      >
        <ExternalLink className="w-4 h-4 mr-1.5" />
        Photos
      </Button>
    </a>
  </div>

  <div className="flex gap-2">
    <Button
      size="sm"
      variant="outline"
      onClick={() => toggleEventActive(event)}
      className="flex-1 border-stone-600 text-stone-400 hover:bg-stone-800"
    >
      {event.is_active ? "Deactivate" : "Activate"}
    </Button>
    <Button
      size="sm"
      variant="outline"
      onClick={() => deleteEvent(event.id)}
      className="border-red-900/50 text-red-400 hover:bg-red-900/20"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  </div>
</div>
        )}
      </main>

      {/* QR Code Modal */}
      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="bg-stone-900 border-stone-700 text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-amber-100">Event QR Code</DialogTitle>
            <DialogDescription className="text-stone-400">
              Share this QR code with your guests to let them access the camera.
            </DialogDescription>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="flex flex-col items-center py-6">
              <div className="bg-white p-4 rounded-lg mb-4">
                <QRCodeSVG
                  value={getEventUrl(selectedEvent.id)}
                  size={200}
                  level="H"
                />
              </div>
              
              <p className="text-amber-100 font-medium mb-2">{selectedEvent.name}</p>
              
              <div className="flex items-center gap-2 bg-stone-800 rounded-lg px-3 py-2 w-full">
                <code className="text-xs text-stone-400 flex-1 truncate">
                  {getEventUrl(selectedEvent.id)}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyEventUrl}
                  className="text-amber-400 hover:text-amber-300 hover:bg-stone-700"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <a
                  href={getEventUrl(selectedEvent.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 p-1"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
