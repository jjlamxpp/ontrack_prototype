import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Survey from './pages/Survey'
import Results from './pages/Results'
import Chat from './pages/Chat'
import './App.css'

function LandingPage({ onStartSurvey }: { onStartSurvey: () => void }) {
  return (
    <div className="min-h-screen bg-[#002B5B] flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-4xl font-bold text-white mb-8">
          OnTrack 職業性向測試
        </h1>
        
        <p className="text-lg text-white/80 mb-12">
          歡迎參加OnTrack職業性向測試。這個測試將幫助你了解自己的職業傾向，
          並為你提供相關的職業建議。測試大約需要15-20分鐘完成。
        </p>

        <div className="space-y-6">
          <button 
            onClick={onStartSurvey}
            className="bg-[#3E9BFF] hover:bg-[#3E9BFF]/90 text-white px-8 py-3 rounded-lg text-lg"
          >
            開始測試
          </button>
          
          <div className="text-white/60 text-sm">
            <p>* 請確保你能夠完整完成所有問題</p>
            <p>* 請根據你的真實想法回答</p>
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 w-full p-4 text-center text-white/40 text-sm">
        © 2024 OnTrack. All rights reserved.
      </footer>
    </div>
  )
}

function App() {
  const [showSurvey, setShowSurvey] = useState(false)

  const handleStartSurvey = () => {
    setShowSurvey(true)
    localStorage.removeItem('surveyCompleted')
    localStorage.removeItem('userName')
  }

  const checkResultsAccess = () => {
    const userName = localStorage.getItem('userName')
    const completed = localStorage.getItem('surveyCompleted')
    console.log('Checking results access:', { userName, completed })
    return userName && completed === 'true'
  }

  return (
    <div className="min-h-screen bg-[#002B5B]">
      <Routes>
        <Route 
          path="/" 
          element={
            showSurvey ? (
              <Navigate to="/survey" replace />
            ) : (
              <LandingPage onStartSurvey={handleStartSurvey} />
            )
          } 
        />
        <Route path="/survey" element={<Survey />} />
        <Route 
          path="/results" 
          element={
            checkResultsAccess() ? (
              <Results />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </div>
  )
}

export default App