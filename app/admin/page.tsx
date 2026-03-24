"use client"

import { useState, useEffect, useCallback } from "react"
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
import { Plus, Calendar, Camera, Users, Trash2, QrCode, Copy, Check, ExternalLink, Image as ImageIcon } from "lucide-react"
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

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const getEventUrl = (eventId: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/snap/${eventId}`
    }
    return `/snap/${eventId}`
    }
  const handleCreateEvent = async () => {
    if (!newEvent.name.trim()) return
    
    const { data, error } = await supabase.from("events").insert([{
      name: newEvent.name,
      description: newEvent.description || null,
      photo_limit: newEvent.photo_limit,
      is_active: true,
      event_date: newEvent.date || null
    }]).select()

    if (error) {
      console.error("Supabase Error:", error)
      alert(`Error: ${error.message}. Ensure 'photo_limit' and 'event_date' columns exist!`)
      return
    }

    setNewEvent({ name: "", description: "", date: "", photo_limit: 25 })
    setIsCreateOpen(false)
    fetchEvents()
  }

  const deleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure? All photos in the filing cabinet will be inaccessible.")) return
    await supabase.from("events").delete().eq("id", eventId)
    fetchEvents()
  }

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center font-mono text-amber-100 italic">Developing Dashboard...</div>

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-mono">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/50 backdrop-blur-md sticky top-0 z-10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-amber-100 tracking-[0.2em] uppercase">Momento Admin</h1>
            <p className="text-stone-500 text-[10px] uppercase tracking-widest">Event Control Center</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded-full px-6 transition-all shadow-[0_0_15px_rgba(217,119,6,0.3)]">
            <Plus className="w-4 h-4 mr-2" /> NEW EVENT
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="bg-stone-900 border-stone-800 hover:border-amber-900/40 transition-all duration-500 group">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-amber-100 text-lg uppercase tracking-tight truncate mr-2">{event.name}</CardTitle>
                  <span className={`text-[8px] px-2 py-0.5 rounded border ${event.is_active ? 'border-green-900 text-green-500' : 'border-stone-700 text-stone-500'}`}>
                    {event.is_active ? 'LIVE' : 'IDLE'}
                  </span>
                </div>
                <CardDescription className="text-stone-500 text-xs truncate uppercase">{event.description || "No description provided"}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="flex gap-4 text-[10px] text-stone-400 uppercase tracking-widest border-b border-stone-800 pb-4">
                  <span className="flex items-center gap-1.5"><Camera className="w-3.5 h-3.5 text-amber-600" /> {event.photo_count} Snaps</span>
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-amber-600" /> {event.guest_count} Guests</span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 bg-stone-800/50 border-stone-700 hover:bg-stone-800 text-xs" onClick={() => { setSelectedEvent(event); setIsQrOpen(true); }}>
                      <QrCode className="w-3.5 h-3.5 mr-2 text-amber-500" /> QR KEY
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 border-blue-900/30 text-blue-400 hover:bg-blue-900/10 text-xs" onClick={() => window.open(`/event/${event.id}`, '_blank')}>
                      <ImageIcon className="w-3.5 h-3.5 mr-2" /> GALLERY
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-red-900 hover:text-red-500 hover:bg-transparent text-[10px] uppercase tracking-tighter" onClick={() => deleteEvent(event.id)}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Destroy Event Record
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* QR MODAL */}
      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="bg-stone-900 border-stone-700 text-stone-100 max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle className="text-amber-100 text-center uppercase tracking-[0.2em] text-sm">Guest Access</DialogTitle></DialogHeader>
          {selectedEvent && (
            <div className="flex flex-col items-center py-6">
              <div className="bg-white p-4 rounded-2xl mb-6 shadow-2xl">
                <<QRCodeSVG 
  value={getEventUrl(selectedEvent.id)} 
  size={220} 
  level="M" // Changed from H to M for better compatibility
  includeMargin={false}
  // Removed imageSettings to make the QR code solid and easier to scan
                />
              </div>
              <div className="flex gap-2 bg-black/50 p-3 rounded-xl border border-stone-800 w-full">
                <code className="text-[9px] text-stone-500 flex-1 truncate self-center">{getEventUrl(selectedEvent.id)}</code>
                <Button variant="ghost" size="sm" className="h-8 w-8" onClick={() => copyUrl(getEventUrl(selectedEvent.id))}>
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CREATE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-stone-900 border-stone-700 text-white rounded-[2rem] shadow-2xl border-2">
          <DialogHeader><DialogTitle className="text-amber-100 uppercase text-center tracking-[0.2em] text-sm py-2">Initialize Event</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-1.5">
              <p className="text-[10px] text-stone-500 uppercase ml-1">Title</p>
              <Input placeholder="E.G. PAVAN WEDDING" value={newEvent.name} onChange={(e) => setNewEvent({...newEvent, name: e.target.value.toUpperCase()})} className="bg-stone-800 border-stone-700 rounded-xl py-6 focus:ring-amber-600 uppercase" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-1.5">
                <p className="text-[10px] text-stone-500 uppercase ml-1">Date</p>
                <Input type="date" value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} className="bg-stone-800 border-stone-700 rounded-xl py-6" />
              </div>
              <div className="w-24 space-y-1.5">
                <p className="text-[10px] text-stone-500 uppercase ml-1">Limit</p>
                <Input type="number" value={newEvent.photo_limit} onChange={(e) => setNewEvent({...newEvent, photo_limit: parseInt(e.target.value) || 25})} className="bg-stone-800 border-stone-700 rounded-xl py-6 text-center" />
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleCreateEvent} className="bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold w-full rounded-2xl py-7 text-lg shadow-lg">ACTIVATE</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
