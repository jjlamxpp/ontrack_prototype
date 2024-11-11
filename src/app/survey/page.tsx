'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/components/ui/use-toast"

// Define types for our form data
interface FormData {
  name: string;
  subjects: (number | string)[];
  yesNoAnswers: string[];
  finalAnswers: string[];
}

// Define types for questions
interface Question {
  type: string;
  question: string;
  category?: string;
}

export default function Survey() {
  const router = useRouter()
  
  // State management
  const [currentPage, setCurrentPage] = useState(1)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  
  // Initialize form data
  const [formData, setFormData] = useState<FormData>({
    name: '',
    subjects: Array(5).fill(''),
    yesNoAnswers: Array(40).fill(''),
    finalAnswers: Array(3).fill('')
  })

  // Fetch questions when page changes
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true)
        const response = await fetch(`http://localhost:8000/get_survey_page/${currentPage}${currentPage === 6 ? `?user_name=${formData.name}` : ''}`)
        const data = await response.json()
        setQuestions(data.questions)
      } catch (error) {
        toast({
          title: "錯誤",
          description: "無法獲取問題，請稍後再試",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchQuestions()
  }, [currentPage, formData.name])

  // Validation function
  const validateCurrentPage = (): boolean => {
    const newErrors: string[] = []

    if (currentPage === 1) {
      if (!formData.name.trim()) {
        newErrors.push('請輸入姓名')
      }
      formData.subjects.forEach((score, index) => {
        const numScore = Number(score)
        if (!score || numScore < 1 || numScore > 7) {
          newErrors.push(`科目 ${index + 1} 分數必須在1-7之間`)
        }
      })
    } else {
      const answers = currentPage === 6 ? formData.finalAnswers : 
        formData.yesNoAnswers.slice((currentPage - 2) * 10, (currentPage - 1) * 10)
      
      answers.forEach((answer, index) => {
        if (!answer) {
          newErrors.push(`請回答問題 ${index + 1}`)
        }
      })
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }

  // Handle next page
  const handleNext = async () => {
    if (!validateCurrentPage()) {
      return
    }

    try {
      setLoading(true)
      
      // Submit current page answers
      const response = await fetch('http://localhost:8000/submit_survey_page/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_name: formData.name,
          page_number: currentPage,
          answers: getCurrentPageAnswers()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit answers')
      }

      if (currentPage < 6) {
        setCurrentPage(prev => prev + 1)
      } else {
        // Submit complete survey
        const finalResponse = await fetch('http://localhost:8000/submit_survey/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_name: formData.name,
            answers: getAllAnswers()
          })
        })

        if (!finalResponse.ok) {
          throw new Error('Failed to submit survey')
        }

        toast({
          title: "成功",
          description: "問卷已成功提交！",
        })
        router.push('/')
      }
    } catch (error) {
      toast({
        title: "錯誤",
        description: "提交失敗，請稍後再試",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle previous page
  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  // Get current page answers
  const getCurrentPageAnswers = () => {
    if (currentPage === 1) {
      return [formData.name, ...formData.subjects]
    } else if (currentPage >= 2 && currentPage <= 5) {
      const startIndex = (currentPage - 2) * 10
      return formData.yesNoAnswers.slice(startIndex, startIndex + 10)
    } else {
      return formData.finalAnswers
    }
  }

  // Get all answers
  const getAllAnswers = () => {
    return [
      formData.name,
      ...formData.subjects,
      ...formData.yesNoAnswers,
      ...formData.finalAnswers
    ]
  }

  // Render personal info form
  const renderPersonalInfo = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name" className="text-white">姓名</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className="bg-white/10 text-white placeholder-white/50"
          placeholder="請輸入您的姓名"
        />
      </div>
      {['中文', '英文', '數學', '選修科目一', '選修科目二'].map((subject, i) => (
        <div key={i}>
          <Label htmlFor={`subject-${i}`} className="text-white">
            DSE {subject} 預測分數 (1-7)
          </Label>
          <Input
            id={`subject-${i}`}
            type="number"
            min="1"
            max="7"
            value={formData.subjects[i]}
            onChange={(e) => {
              const newSubjects = [...formData.subjects]
              newSubjects[i] = e.target.value
              setFormData({...formData, subjects: newSubjects})
            }}
            className="bg-white/10 text-white placeholder-white/50"
            placeholder="1-7"
          />
        </div>
      ))}
    </div>
  )

  // Render yes/no questions
  const renderYesNoQuestions = () => (
    <div className="space-y-6">
      {questions.map((question, i) => (
        <div key={i} className="space-y-2">
          <p className="font-medium text-white">{question.question}</p>
          <RadioGroup
            value={currentPage === 6 ? 
              formData.finalAnswers[i] : 
              formData.yesNoAnswers[(currentPage - 2) * 10 + i]
            }
            onValueChange={(value) => {
              if (currentPage === 6) {
                const newAnswers = [...formData.finalAnswers]
                newAnswers[i] = value
                setFormData({...formData, finalAnswers: newAnswers})
              } else {
                const newAnswers = [...formData.yesNoAnswers]
                newAnswers[(currentPage - 2) * 10 + i] = value
                setFormData({...formData, yesNoAnswers: newAnswers})
              }
            }}
          >
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id={`yes-${i}`} />
                <Label htmlFor={`yes-${i}`} className="text-white">是</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id={`no-${i}`} />
                <Label htmlFor={`no-${i}`} className="text-white">否</Label>
              </div>
            </div>
          </RadioGroup>
        </div>
      ))}
    </div>
  )

  // Main render
  return (
    <div className="min-h-screen bg-[#002B5B] text-white p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-8">
          <Progress 
            value={(currentPage / 6) * 100} 
            className="h-2 bg-white/20" 
          />
          <p className="text-center mt-2">第 {currentPage} 頁，共 6 頁</p>
        </div>

        <Card className="p-6 bg-white/10 backdrop-blur">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              <p className="mt-4">載入中...</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-center mb-6">
                {currentPage === 1 ? '基本資料' :
                 currentPage >= 2 && currentPage <= 5 ? `問卷調查 - 第 ${currentPage - 1} 部分` :
                 '最終問題'}
              </h2>

              {errors.length > 0 && (
                <div className="mb-4 p-4 bg-red-500/20 rounded-md">
                  {errors.map((error, index) => (
                    <p key={index} className="text-red-300">{error}</p>
                  ))}
                </div>
              )}

              {currentPage === 1 ? renderPersonalInfo() : renderYesNoQuestions()}

              <div className="mt-8 flex justify-between">
                <Button 
                  onClick={handlePrevious} 
                  disabled={currentPage === 1 || loading}
                  className="bg-white/20 hover:bg-white/30 text-white"
                >
                  上一頁
                </Button>
                <Button 
                  onClick={handleNext}
                  disabled={loading}
                  className="bg-[#3E9BFF] hover:bg-[#3E9BFF]/90 text-white"
                >
                  {currentPage === 6 ? '完成' : '下一頁'}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}