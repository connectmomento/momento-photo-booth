"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabase"
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
  event_date?: string | null
  photo_limit: number
  is_active: boolean
  photo_count?: number
  guest_count?: number
}

export default function AdminDashboard() {
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [copied, setCopied] = useState(false)
  
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
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const getEventUrl = (eventId: string) => {
    // Hardcoded production URL for cleaner QR codes
    return `https://project-04vwo.vercel.app/snap/${eventId}`
  }

  const handleCreateEvent = async () => {
    if (!newEvent.name.trim()) return
    const { error } = await supabase.from("events").insert([{
      name: newEvent.name,
      description: newEvent.description || null,
      photo_limit: newEvent.photo_limit,
      is_active: true,
      event_date: newEvent.date || null
    }])
    
    if (!error) {
      setNewEvent({ name: "", description: "", date: "", photo_limit: 25 })
      setIsCreateOpen(false)
      fetchEvents()
    }
  }

  const deleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure? This will delete all event records.")) return
    await supabase.from("events").delete().eq("id", eventId)
    fetchEvents()
  }

  if (isLoading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-amber-100 font-mono">Loading...</div>

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 bg-stone-900/50 p-6 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold text-amber-100">Admin</h1>
          <p className="text-stone-400 text-sm">Manage your booth</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-stone-900">
          <Plus className="w-4 h-4 mr-2" /> New Event
        </Button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="bg-stone-900 border-stone-800">
              <CardHeader>
                <CardTitle className="text-amber-100 truncate">{event.name}</CardTitle>
                <CardDescription className="text-stone-400 truncate">{event.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 text-stone-400 text-sm">
                  <span className="flex items-center gap-1"><Camera className="w-4 h-4" /> {event.photo_count}</span>
                  <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {event.guest_count}</span>
                </div>
                
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedEvent(event); setIsQrOpen(true); }}>
                      <QrCode className="w-4 h-4 mr-1.5" /> QR Code
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 border-blue-600/50 text-blue-400" onClick={() => window.open(`/event/${event.id}`, '_blank')}>
                      <ExternalLink className="w-4 h-4 mr-1.5" /> Photos
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="border-red-900/50 text-red-400" onClick={() => deleteEvent(event.id)}>
                    <Trash2 className="w-4 h-4 mr-1.5" /> Delete Event
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* QR Code Modal */}
      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="bg-stone-900 border-stone-700 text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-amber-100">Event QR Code</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="flex flex-col items-center py-6">
              <div className="bg-white p-4 rounded-lg mb-4">
                <QRCodeSVG value={getEventUrl(selectedEvent.id)} size={200} level="H" />
              </div>
              <code className="text-xs text-stone-400 break-all bg-stone-800 p-2 rounded w-full text-center">
                {getEventUrl(selectedEvent.id)}
              </code>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Modal - Simplified for logic check */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-stone-900 border-stone-700 text-white">
          <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
             <Input placeholder="Event Name" value={newEvent.name} onChange={(e) => setNewEvent({...newEvent, name: e.target.value})} className="bg-stone-800 border-stone-700" />
             <Input type="date" value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} className="bg-stone-800 border-stone-700" />
          </div>
          <DialogFooter>
            <Button onClick={handleCreateEvent} className="bg-amber-600 text-stone-900">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
