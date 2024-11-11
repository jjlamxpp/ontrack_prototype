import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Send, ArrowLeft } from 'lucide-react'

interface Message {
  role: 'user' | 'bot'
  content: string
}

export default function Chat() {
  const location = useLocation()
  const navigate = useNavigate()
  const [userName, setUserName] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Preset questions
  const presetQuestions = [
    "分析我應該發展的技能",
    "分析適合我性格的行業",
    "建議我參與什麼課外活動",
    "關於我的JUPAS選科"
  ]

  useEffect(() => {
    // Get userName from localStorage
    const storedUserName = localStorage.getItem('userName')
    if (!storedUserName) {
      navigate('/')
      return
    }
    setUserName(storedUserName)
  }, [navigate])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (message: string, presetIndex?: number) => {
    if (!message.trim() || isLoading) return

    setIsLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: message }])
    setInputMessage('')

    try {
      const response = await fetch(`http://localhost:8000/chat/${encodeURIComponent(userName)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          preset_question: presetIndex !== undefined ? presetIndex + 1 : null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to get response')
      }

      const data = await response.json()
      console.log('Chat Response:', data) // Debug log
      
      if (data.response) {
        setMessages(prev => [...prev, { role: 'bot', content: data.response }])
      } else {
        throw new Error('No response content')
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: '抱歉，我現在無法回應。請稍後再試。' 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#002B5B] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 w-full z-10 bg-[#002B5B]/95 backdrop-blur-sm p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <span className="text-[#3E9BFF] text-2xl font-bold">On</span>
          <span className="text-white text-2xl font-bold">Track Chat</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto p-4 space-y-4">
        {/* Preset Questions */}
        <Card className="p-4 bg-white/10 backdrop-blur">
          <div className="grid grid-cols-2 gap-2">
            {presetQuestions.map((question, index) => (
              <Button
                key={index}
                variant="outline"
                className="text-left"
                onClick={() => handleSendMessage(question, index)}
                disabled={isLoading}
              >
                {question}
              </Button>
            ))}
          </div>
        </Card>

        {/* Chat Messages */}
        <Card className="flex-grow p-4 bg-white/10 backdrop-blur min-h-[400px] max-h-[600px] overflow-y-auto">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-[#3E9BFF] text-white'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </Card>

        {/* Input Area */}
        <Card className="p-4 bg-white/10 backdrop-blur">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputMessage)}
              placeholder="輸入訊息..."
              className="flex-grow p-2 rounded bg-white/10 text-white border border-white/20"
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSendMessage(inputMessage)}
              disabled={isLoading || !inputMessage.trim()}
              className="bg-[#3E9BFF] hover:bg-[#3E9BFF]/90"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </Card>
      </main>
    </div>
  )
}