import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-4xl font-bold text-amber-100 font-mono mb-4">Momento</h1>
      <p className="text-amber-100/60 font-mono mb-8 text-sm uppercase tracking-widest">Digital Disposable Camera</p>
      <div className="bg-stone-800 p-6 rounded-2xl border border-white/10 shadow-2xl">
        <p className="text-amber-100/80 font-mono text-sm mb-4">Are you a Host?</p>
        <Link 
          href="/admin" 
          className="bg-amber-600 hover:bg-amber-500 text-stone-900 px-6 py-3 rounded-full font-bold transition-colors inline-block"
        >
          Go to Admin Dashboard
        </Link>
      </div>
    </div>
  )
}
