'use client'

import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-[#002B5B] flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          OnTrack 職業性向測試
        </h1>
        
        <p className="text-lg text-white/80 max-w-2xl mx-auto">
          歡迎參加OnTrack職業性向測試。這個測試將幫助你了解自己的職業傾向，
          並為你提供相關的職業建議。測試大約需要15-20分鐘完成。
        </p>

        <div className="space-y-4">
          <Button 
            onClick={() => router.push('/survey')}
            className="bg-[#3E9BFF] hover:bg-[#3E9BFF]/90 text-white px-8 py-4 text-lg"
          >
            開始測試
          </Button>
          
          <div className="text-white/60 text-sm">
            <p>* 請確保你能夠完整完成所有問題</p>
            <p>* 請根據你的真實想法回答</p>
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 w-full p-4 text-center text-white/40 text-sm">
        © 2024 OnTrack. All rights reserved.
      </footer>
    </main>
  )
}