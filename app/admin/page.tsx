"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Camera, Users, Trash2, QrCode, Copy, Check, ExternalLink } from "lucide-react"
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
    
    if (error) return
    
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

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const getEventUrl = (eventId: string) => `https://project-04vwo.vercel.app/snap/${eventId}`

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
    if (!confirm("Are you sure? This deletes everything for this event.")) return
    await supabase.from("events").delete().eq("id", eventId)
    fetchEvents()
  }

  if (isLoading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-amber-100 font-mono italic">Loading Admin...</div>

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-mono">
      <header className="border-b border-stone-800 bg-stone-900/50 p-6 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-bold text-amber-100 uppercase tracking-tighter">Momento Admin</h1>
          <p className="text-stone-500 text-[10px] uppercase tracking-widest">Control Center</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-amber-600 text-stone-900 font-bold rounded-full">
          <Plus className="w-4 h-4 mr-2" /> New Event
        </Button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="bg-stone-900 border-stone-800 shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-100 truncate text-lg uppercase tracking-tight">{event.name}</CardTitle>
                <CardDescription className="text-stone-500 truncate text-xs">{event.description || "No description"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4 text-stone-400 text-[10px] uppercase tracking-widest border-b border-stone-800 pb-4">
                  <span className="flex items-center gap-1.5"><Camera className="w-3 h-3 text-amber-600" /> {event.photo_count} Snaps</span>
                  <span className="flex items-center gap-1.5"><Users className="w-3 h-3 text-amber-600" /> {event.guest_count} Guests</span>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm" className="flex-1 bg-stone-800 border-stone-700 text-xs" onClick={() => { setSelectedEvent(event); setIsQrOpen(true); }}>
                      <QrCode className="w-3 h-3 mr-2 text-amber-500" /> QR
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 border-blue-900/50 text-blue-400 text-xs" onClick={() => window.open(`/event/${event.id}`, '_blank')}>
                      <ExternalLink className="w-3 h-3 mr-2" /> Gallery
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-900 hover:text-red-500 text-[10px] uppercase" onClick={() => deleteEvent(event.id)}>
                    <Trash2 className="w-3 h-3 mr-2" /> Destroy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="bg-stone-900 border-stone-700 text-stone-100 max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle className="text-amber-100 text-center uppercase tracking-widest text-sm">Guest Key</DialogTitle></DialogHeader>
          {selectedEvent && (
            <div className="flex flex-col items-center py-4">
              <div className="bg-white p-4 rounded-2xl mb-6 shadow-xl">
                <QRCodeSVG value={getEventUrl(selectedEvent.id)} size={220} level="H" includeMargin={false} imageSettings={{ src: "/camera-icon.png", height: 40, width: 40, excavate: true }} />
              </div>
              <div className="flex gap-2 bg-stone-950 p-2 rounded-lg border border-stone-800 w-full">
                <code className="text-[9px] text-stone-400 flex-1 truncate self-center">{getEventUrl(selectedEvent.id)}</code>
                <Button variant="ghost" size="sm" className="h-8 w-8" onClick={() => copyToClipboard(getEventUrl(selectedEvent.id))}>
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-amber-600" />}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-stone-900 border-stone-700 text-white rounded-3xl">
          <DialogHeader><DialogTitle className="text-amber-100 uppercase text-sm tracking-widest">Launch Event</DialogTitle></DialogHeader>
          <div className="space-y-4 py-6">
             <Input placeholder="EVENT TITLE" value={newEvent.name} onChange={(e) => setNewEvent({...newEvent, name: e.target.value.toUpperCase()})} className="bg-stone-800 border-stone-700 uppercase" />
             <Input type="date" value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} className="bg-stone-800 border-stone-700" />
          </div>
          <DialogFooter><Button onClick={handleCreateEvent} className="bg-amber-600 text-stone-900 font-bold w-full rounded-xl">ACTIVATE</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
