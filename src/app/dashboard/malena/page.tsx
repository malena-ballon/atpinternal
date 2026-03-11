import { Heart } from 'lucide-react'

export default function MalenaPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
        Happy Birthday
      </h1>
      
      <div
        className="rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          minHeight: '400px'
        }}
      >
        {/* A little pulsing heart icon */}
        <Heart 
          size={56} 
          className="mb-6 animate-pulse" 
          style={{ color: '#E11D48' }} 
          fill="#E11D48" 
        />
        
        <h2 
          className="text-4xl md:text-5xl font-extrabold mb-4" 
          style={{ color: 'var(--color-text-primary)' }}
        >
          Happy Birthday, Love!
        </h2>
        
        <p 
          className="text-lg max-w-xl mt-2 leading-relaxed" 
          style={{ color: 'var(--color-text-secondary)' }}
        >
          hehe love you
        </p>
      </div>
    </div>
  )
}