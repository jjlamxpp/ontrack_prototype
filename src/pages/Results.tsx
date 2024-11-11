import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"


// Define interfaces
interface CareerPath {
  title: string
  description: string
  required_skills: string
  education: string
  progression: string
}

interface EmergingCareerPath {
  title: string
  description: string
  required_skills: string
  education: string
  growth_potential: string
}

interface JupasProgram {
  course_name: string
  jupas_code: string
  institution: string
  median_score_index: number
  mandatory_subjects?: string
  bonus_items?: string
  includes?: string
}

interface JupasRecommendation {
  industry: string
  program: JupasProgram
  score_difference: number
}

interface JupasResponse {
  user_name: string
  average_dse_score: number
  matching_industries: string[]
  recommendations: JupasRecommendation[]
}

export default function Results() {
  const navigate = useNavigate()
  const [userName, setUserName] = useState<string>('')
  const [error, setError] = useState<string>('');

  // States
  const [careerView, setCareerView] = useState<'traditional' | 'emerging'>('traditional')
  const [careerPaths, setCareerPaths] = useState<(CareerPath | EmergingCareerPath)[]>([])
  const [traditionalCareerPaths, setTraditionalCareerPaths] = useState<CareerPath[]>([])
  const [emergingCareerPaths, setEmergingCareerPaths] = useState<EmergingCareerPath[]>([])
  const [currentPathIndex, setCurrentPathIndex] = useState(0)
  const [hollandCodes, setHollandCodes] = useState<string[]>([])
  const [isLoadingCareers, setIsLoadingCareers] = useState(true)
  const [careerError, setCareerError] = useState('')
  const [jupasData, setJupasData] = useState<JupasResponse | null>(null)
  const [currentJupasIndex, setCurrentJupasIndex] = useState(0)
  const [isLoadingJupas, setIsLoadingJupas] = useState(true)
  const [jupasError, setJupasError] = useState('')
  const [showInterestForm, setShowInterestForm] = useState(false)
  const [isLoadingEmerging, setIsLoadingEmerging] = useState(false)
  const [emergingError, setEmergingError] = useState('')
  const [interestWords, setInterestWords] = useState(['', '', ''])
  const [isSubmittingInterests, setIsSubmittingInterests] = useState(false)
  const [personalityAnalysis, setPersonalityAnalysis] = useState<string>('')
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(true)
  const [analysisError, setAnalysisError] = useState('')
  
  // First useEffect to check access and set userName
  useEffect(() => {
    const storedUserName = localStorage.getItem('userName')
    const surveyCompleted = localStorage.getItem('surveyCompleted')
    
    if (!storedUserName || !surveyCompleted) {
      console.log('Missing required data:', { storedUserName, surveyCompleted })
      navigate('/', { replace: true })
      return
    }

    setUserName(storedUserName)
  }, [navigate])

  // Second useEffect for data fetching
  useEffect(() => {
    // Only fetch if we have a userName
    if (!userName) return

    const fetchData = async () => {
      try {
        setIsLoadingCareers(true)
        setIsLoadingJupas(true)
        setIsLoadingAnalysis(true)
        setCareerError('')
        setJupasError('')
        setAnalysisError('')

        // Parallel data fetching using userName from state
        const [careerResponse, jupasResponse, analysisResponse] = await Promise.all([
          fetch(`http://localhost:8000/get_career_paths/${encodeURIComponent(userName)}`),
          fetch(`http://localhost:8000/get_jupas_recommendations/${encodeURIComponent(userName)}`),
          fetch(`http://localhost:8000/get_personality_analysis/${encodeURIComponent(userName)}`)
        ])

        // Check responses
        if (!careerResponse.ok) {
          const errorData = await careerResponse.json()
          throw new Error(errorData.detail || 'Failed to fetch career paths')
        }
        if (!jupasResponse.ok) {
          const errorData = await jupasResponse.json()
          throw new Error(errorData.detail || 'Failed to fetch JUPAS recommendations')
        }
        if (!analysisResponse.ok) {
          const errorData = await analysisResponse.json()
          throw new Error(errorData.detail || 'Failed to fetch personality analysis')
        }

        const [careerData, jupasData, analysisData] = await Promise.all([
          careerResponse.json(),
          jupasResponse.json(),
          analysisResponse.json()
        ])

        console.log('Fetched data:', { careerData, jupasData, analysisData })

        setTraditionalCareerPaths(careerData.career_paths)
        setCareerPaths(careerData.career_paths)
        setHollandCodes(careerData.holland_codes)
        setJupasData(jupasData)
        setPersonalityAnalysis(analysisData.analysis)
      } catch (error) {
        console.error('Data fetch error:', error)
        setError(error instanceof Error ? error.message : '無法載入資料')
        setCareerError('無法載入職業建議')
        setJupasError('無法載入JUPAS建議')
        setAnalysisError('無法載入性格分析')
      } finally {
        setIsLoadingCareers(false)
        setIsLoadingJupas(false)
        setIsLoadingAnalysis(false)
      }
    }

    fetchData()
  }, [userName]) // Only depend on userName

  // Add handlers
  const handleCareerViewChange = (view: 'traditional' | 'emerging') => {
    setCareerView(view)
    setCurrentPathIndex(0)
    if (view === 'traditional') {
      setCareerPaths(traditionalCareerPaths)
    } else if (emergingCareerPaths.length > 0) {
      setCareerPaths(emergingCareerPaths)
    }
  }

  const handleNextPath = () => {
    if (currentPathIndex < careerPaths.length - 1) {
      setCurrentPathIndex(prev => prev + 1)
    }
  }

  const handlePreviousPath = () => {
    if (currentPathIndex > 0) {
      setCurrentPathIndex(prev => prev - 1)
    }
  }

  const handleNextJupas = () => {
    if (jupasData && currentJupasIndex < jupasData.recommendations.length - 1) {
      setCurrentJupasIndex(prev => prev + 1)
    }
  }

  const handlePreviousJupas = () => {
    if (currentJupasIndex > 0) {
      setCurrentJupasIndex(prev => prev - 1)
    }
  }

  const handleChatClick = () => {
    navigate('/chat')
  }

  // Interest Form Component
  const InterestForm = () => {
    // Local state for form inputs to prevent lag
    const [localInterests, setLocalInterests] = useState(interestWords)
  
    const handleInputChange = (index: number, value: string) => {
      const newInterests = [...localInterests]
      newInterests[index] = value
      setLocalInterests(newInterests)
    }
  
    const handleSubmit = () => {
      setInterestWords(localInterests) // Update parent state only on submit
      handleInterestSubmit()
    }
  
    return (
      <div className="space-y-6 p-4">
        <div>
          <h3 className="font-semibold mb-2">你最喜歡的運動是什麼？</h3>
          <input
            type="text"
            value={localInterests[0]}
            onChange={(e) => handleInputChange(0, e.target.value)}
            className="w-full p-2 rounded bg-white/10 text-white border border-white/20"
            placeholder="輸入運動"
          />
        </div>
        <div>
          <h3 className="font-semibold mb-2">你每天會花12小時或以上做什麼活動？</h3>
          <input
            type="text"
            value={localInterests[1]}
            onChange={(e) => handleInputChange(1, e.target.value)}
            className="w-full p-2 rounded bg-white/10 text-white border border-white/20"
            placeholder="輸入活動"
          />
        </div>
        <div>
          <h3 className="font-semibold mb-2">如果你是億萬富翁，你最想買的第一件東西是什麼？</h3>
          <input
            type="text"
            value={localInterests[2]}
            onChange={(e) => handleInputChange(2, e.target.value)}
            className="w-full p-2 rounded bg-white/10 text-white border border-white/20"
            placeholder="輸入物品"
          />
        </div>
        <Button 
          className="w-full bg-[#3E9BFF] hover:bg-[#3E9BFF]/90"
          onClick={handleSubmit}
          disabled={isSubmittingInterests || !localInterests.every(word => word.trim())}
        >
          {isSubmittingInterests ? '提交中...' : '提交'}
        </Button>
        {emergingError && (
          <p className="text-red-500 text-center">{emergingError}</p>
        )}
      </div>
    )
  }

  const handleInterestSubmit = async () => {
    if (isSubmittingInterests) return

    const trimmedWords = interestWords.map(w => w.trim())
    if (!trimmedWords.every(word => word)) {
      setEmergingError('請填寫所有興趣項目')
      return
    }

    setIsSubmittingInterests(true)
    setEmergingError('')
    setIsLoadingEmerging(true)

    try {
      const params = new URLSearchParams({
        favorite_sport: trimmedWords[0],
        passionate_activity: trimmedWords[1],
        billionaire_purchase: trimmedWords[2]
      })

      const response = await fetch(
        `http://localhost:8000/get_emerging_careers/${encodeURIComponent(userName)}?${params}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to fetch emerging careers')
      }

      const data = await response.json()
      console.log('Emerging Careers:', data) // Debug log

      if (data.emerging_careers && Array.isArray(data.emerging_careers)) {
        setEmergingCareerPaths(data.emerging_careers)
        setCareerPaths(data.emerging_careers)
        setCurrentPathIndex(0)
        setShowInterestForm(false)
      } else {
        throw new Error('Invalid emerging careers data')
      }
    } catch (error) {
      console.error('Error fetching emerging careers:', error)
      setEmergingError(error instanceof Error ? error.message : '無法獲取新興職業建議')
    } finally {
      setIsSubmittingInterests(false)
      setIsLoadingEmerging(false)
    }
  }

  // Render
  if (!userName) {
    return null
  }

  // Show loading state
  if (isLoadingCareers || isLoadingJupas || isLoadingAnalysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#002B5B]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#002B5B]">
        <div className="text-white text-center">
          <p className="text-xl mb-4">{error}</p>
          <Button onClick={() => navigate('/', { replace: true })}>
            返回首頁
          </Button>
        </div>
      </div>
    );
  }

  const renderPersonalityAnalysis = () => {
    if (isLoadingAnalysis) {
      return <div className="animate-pulse bg-white/10 h-20 rounded"></div>
    }

    if (analysisError) {
      return <div className="text-red-500">{analysisError}</div>
    }

    return (
      <div className="whitespace-pre-wrap text-white/80">
        {personalityAnalysis}
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#002B5B] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 w-full z-10 bg-[#002B5B]/95 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <span className="text-[#3E9BFF] text-2xl font-bold">On</span>
          <span className="text-white text-2xl font-bold">Track</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto p-4 space-y-6">
        {/* Career Personality Card */}
        <Card className="p-6 bg-white/10 backdrop-blur">
          <h2 className="text-xl font-bold mb-4">你的職業性格</h2>
          {isLoadingCareers || isLoadingAnalysis ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : careerError || analysisError ? (
            <div className="text-center text-red-500 p-4">{careerError || analysisError}</div>
          ) : (
            <div className="space-y-4">
              {/* Holland Code and Industries */}
              <div className="mb-4">
                <p className="text-lg mb-2">Holland Code: {hollandCodes.join(' / ')}</p>
                <p className="text-white/80">
                  匹配行業: {jupasData?.matching_industries.join('、')}
                </p>
              </div>
              
              {/* Personality Analysis */}
              <div className="border-t border-white/10 pt-4">
                <h3 className="font-semibold mb-2">性格分析：</h3>
                <div className="text-white/80 whitespace-pre-wrap">
                  {personalityAnalysis}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* JUPAS Section */}
        <Card className="p-6 bg-white/10 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={handlePreviousJupas}
              disabled={currentJupasIndex === 0}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <h2 className="text-xl font-bold">JUPAS 選科建議</h2>
            <Button
              variant="ghost"
              onClick={handleNextJupas}
              disabled={!jupasData || currentJupasIndex === jupasData.recommendations.length - 1}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>

          {isLoadingJupas ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : jupasError ? (
            <div className="text-center text-red-500 p-4">{jupasError}</div>
          ) : jupasData && jupasData.recommendations.length > 0 ? (
            <>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">課程名稱：</h3>
                  <p className="text-white/80">{jupasData.recommendations[currentJupasIndex].program.course_name}</p>
                </div>
                <div>
                  <h3 className="font-semibold">JUPAS 編號：</h3>
                  <p className="text-white/80">{jupasData.recommendations[currentJupasIndex].program.jupas_code}</p>
                </div>
                <div>
                  <h3 className="font-semibold">院校：</h3>
                  <p className="text-white/80">{jupasData.recommendations[currentJupasIndex].program.institution}</p>
                </div>
                <div>
                  <h3 className="font-semibold">入學要求：</h3>
                  <p className="text-white/80">
                    中位數：{jupasData.recommendations[currentJupasIndex].program.median_score_index}
                    {jupasData.recommendations[currentJupasIndex].program.mandatory_subjects && 
                      `，必修科目：${jupasData.recommendations[currentJupasIndex].program.mandatory_subjects}`}
                  </p>
                </div>
              </div>
              <div className="text-center text-white/60 text-sm mt-4">
                {currentJupasIndex + 1} / {jupasData.recommendations.length}
              </div>
            </>
          ) : (
            <p className="text-center">No JUPAS recommendations available.</p>
          )}
        </Card>

        {/* Career Direction Card */}
        <Card className="p-6 bg-white/10 backdrop-blur">
          <div className="flex justify-center gap-4 mb-4">
            <Button
              variant={careerView === 'traditional' ? 'default' : 'ghost'}
              onClick={() => handleCareerViewChange('traditional')}
              className="text-lg"
            >
              傳統職業方向
            </Button>
            <span className="text-lg">|</span>
            <Button
              variant={careerView === 'emerging' ? 'default' : 'ghost'}
              onClick={() => handleCareerViewChange('emerging')}
              className="text-lg"
            >
              新興職業方向
            </Button>
          </div>

          {careerView === 'emerging' && showInterestForm ? (
            <InterestForm />
          ) : (
            <div className="space-y-4">
              {isLoadingCareers || isLoadingEmerging ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              ) : careerError || emergingError ? (
                <div className="text-center text-red-500 p-4">{careerError || emergingError}</div>
              ) : careerPaths.length > 0 ? (
                <>
                  <div>
                    <h3 className="text-xl font-bold">{careerPaths[currentPathIndex].title}</h3>
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">工作描述：</h4>
                      <p className="text-white/80">{careerPaths[currentPathIndex].description}</p>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">所需技能：</h4>
                      <p className="text-white/80">{careerPaths[currentPathIndex].required_skills}</p>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">學歷要求：</h4>
                      <p className="text-white/80">{careerPaths[currentPathIndex].education}</p>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">職業發展：</h4>
                      <p className="text-white/80">
                        {careerView === 'traditional' 
                          ? careerPaths[currentPathIndex].progression 
                          : (careerPaths[currentPathIndex] as EmergingCareerPath).growth_potential}
                      </p>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <Button
                        variant="ghost"
                        onClick={handlePreviousPath}
                        disabled={currentPathIndex === 0}
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                      <span className="text-white/60">
                        {currentPathIndex + 1} / {careerPaths.length}
                      </span>
                      <Button
                        variant="ghost"
                        onClick={handleNextPath}
                        disabled={currentPathIndex === careerPaths.length - 1}
                      >
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                    </div>
                  </div>
                  {careerView === 'emerging' && (
                    <Button 
                      className="w-full mt-4 bg-[#3E9BFF] hover:bg-[#3E9BFF]/90" 
                      onClick={() => {
                        setInterestWords(['', '', ''])
                        setShowInterestForm(true)
                      }}
                    >
                      重新輸入興趣
                    </Button>
                  )}
                </>
              ) : careerView === 'emerging' ? (
                <Button 
                  className="w-full bg-[#3E9BFF] hover:bg-[#3E9BFF]/90"
                  onClick={() => setShowInterestForm(true)}
                >
                  開始輸入興趣
                </Button>
              ) : (
                <p className="text-center">No career paths available.</p>
              )}
            </div>
          )}
        </Card>

        {/* Chat Button */}
        <div className="fixed bottom-6 right-6 z-20">
          <Button 
            size="lg" 
            className="rounded-full bg-[#3E9BFF] hover:bg-[#3E9BFF]/90"
            onClick={handleChatClick}
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Chatbox
          </Button>
        </div>
      </main>
    </div>
  )
}