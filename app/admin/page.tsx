"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, Camera, Users, Trash2, QrCode, Copy, Check, ExternalLink } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

export default function AdminDashboard() {
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [newEvent, setNewEvent] = useState({ name: "", date: "", photo_limit: 25 })

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false })
    if (data) {
      const withCounts = await Promise.all(data.map(async (e) => {
        const [{ count: p }, { count: g }] = await Promise.all([
          supabase.from("photos").select("id", { count: "exact" }).eq("event_id", e.id),
          supabase.from("guests").select("id", { count: "exact" }).eq("event_id", e.id),
        ])
        return { ...e, photo_count: p || 0, guest_count: g || 0 }
      }))
      setEvents(withCounts)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const handleCreate = async () => {
    if (!newEvent.name.trim()) return
    await supabase.from("events").insert([{
      name: newEvent.name,
      photo_limit: newEvent.photo_limit,
      is_active: true,
      event_date: newEvent.date || null
    }])
    setNewEvent({ name: "", date: "", photo_limit: 25 })
    setIsCreateOpen(false)
    fetchEvents()
  }

  if (isLoading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-amber-100 font-mono">LOADING...</div>

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-mono">
      <header className="border-b border-stone-800 p-6 flex justify-between items-center sticky top-0 bg-stone-950/80 backdrop-blur-md z-10">
        <h1 className="text-xl font-bold text-amber-100 uppercase tracking-tighter">Momento Admin</h1>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-amber-600 text-stone-900 rounded-full font-bold">
          <Plus className="w-4 h-4 mr-2" /> NEW EVENT
        </Button>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Card key={event.id} className="bg-stone-900 border-stone-800">
            <CardHeader>
              <CardTitle className="text-amber-100 truncate uppercase text-sm">{event.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 text-[10px] text-stone-500 uppercase tracking-widest border-b border-stone-800 pb-2">
                <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> {event.photo_count} Snaps</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {event.guest_count} Guests</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setSelectedEvent(event); setIsQrOpen(true); }}>
                    <QrCode className="w-3 h-3 mr-2" /> QR
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-blue-400 border-blue-900/30 text-xs" onClick={() => window.open(`/event/${event.id}`, '_blank')}>
                    <ExternalLink className="w-3 h-3 mr-2" /> GALLERY
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="text-red-900 text-[10px]" onClick={() => { if(confirm("Delete?")) supabase.from("events").delete().eq("id", event.id).then(() => fetchEvents()) }}>
                  <Trash2 className="w-3 h-3 mr-2" /> DESTROY
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>

      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="bg-stone-900 border-stone-800 text-white max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle className="text-center text-xs uppercase tracking-widest">Guest Key</DialogTitle></DialogHeader>
          {selectedEvent && (
            <div className="flex flex-col items-center p-4">
              <div className="bg-white p-4 rounded-xl mb-4">
                <QRCodeSVG value={`https://project-04vwo.vercel.app/snap/${selectedEvent.id}`} size={200} level="H" />
              </div>
              <div className="flex gap-2 bg-black p-2 rounded w-full border border-stone-800">
                <code className="text-[9px] text-stone-500 flex-1 truncate self-center">/snap/{selectedEvent.id}</code>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(`https://project-04vwo.vercel.app/snap/${selectedEvent.id}`); setCopied(true); setTimeout(()=>setCopied(false), 2000); }}>
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-amber-600" />}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-stone-900 border-stone-800 text-white rounded-3xl">
          <DialogHeader><DialogTitle className="text-xs uppercase tracking-widest">New Event</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="EVENT NAME" value={newEvent.name} onChange={(e)=>setNewEvent({...newEvent, name: e.target.value.toUpperCase()})} className="bg-stone-800 border-stone-700" />
            <div className="flex gap-2">
              <Input type="date" value={newEvent.date} onChange={(e)=>setNewEvent({...newEvent, date: e.target.value})} className="bg-stone-800 border-stone-700" />
              <Input type="number" placeholder="LIMIT" value={newEvent.photo_limit} onChange={(e)=>setNewEvent({...newEvent, photo_limit: parseInt(e.target.value)||25})} className="bg-stone-800 border-stone-700 w-24" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleCreate} className="w-full bg-amber-600 text-stone-950 font-bold rounded-xl">ACTIVATE</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
