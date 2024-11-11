import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Question {
  question: string;
  category?: string;
  type?: string;
}

interface PageQuestions {
  questions: Question[];
}

export default function Survey() {
    const navigate = useNavigate()
    const [name, setName] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [questions, setQuestions] = useState<Question[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [pageAnswers, setPageAnswers] = useState<(string | number)[]>([])
    const [allAnswers, setAllAnswers] = useState<(string | number)[]>([])
    const [yesNoAnswers, setYesNoAnswers] = useState<string[]>([])

    // Add this useEffect to debug state changes
    useEffect(() => {
        console.log('Current state:', {
            currentPage,
            name,
            pageAnswers,
            allAnswers
        });
    }, [currentPage, name, pageAnswers, allAnswers]);
  
    // Initialize first page
    useEffect(() => {
      if (currentPage === 1) {
        const initialQuestions = [
          { question: "請輸入你的名", type: "text" },
          { question: "DSE Chinese predicted score (1-7)", type: "score" },
          { question: "DSE English predicted score (1-7)", type: "score" },
          { question: "DSE Mathematics predicted score (1-7)", type: "score" },
          { question: "DSE Elective 1 predicted score (1-7)", type: "score" },
          { question: "DSE Elective 2 predicted score (1-7)", type: "score" }
        ];
        setQuestions(initialQuestions);
        setPageAnswers(new Array(initialQuestions.length).fill(''));
        setIsLoading(false);
      }
    }, [currentPage]);
  
    // Fetch questions for pages 2-6
    useEffect(() => {
      const fetchQuestions = async () => {
        if (currentPage > 1) {
          try {
            setIsLoading(true);
            const response = await fetch(
              `http://localhost:8000/get_survey_page/${currentPage}${name ? `?user_name=${name}` : ''}`
            );
  
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.detail || 'Failed to fetch questions');
            }
  
            const data: PageQuestions = await response.json();
            console.log(`Fetched questions for page ${currentPage}:`, data.questions); // Debug log
            
            if (!data.questions || !Array.isArray(data.questions)) {
              throw new Error('Invalid questions data received');
            }

            // For page 6, ensure we're getting the correct number of questions
            if (currentPage === 6) {
                console.log('Page 6 questions:', data.questions);
                // Reset page answers for the new questions
                setPageAnswers(new Array(data.questions.length).fill(''));
            }

            setQuestions(data.questions);
            setPageAnswers(new Array(data.questions.length).fill(''));
            setError('');
          } catch (error) {
            console.error('Error fetching questions:', error);
            setError('無法載入問題，請重試');
          } finally {
            setIsLoading(false);
          }
        }
      };
  
      if (currentPage > 1) {
        fetchQuestions();
      }
    }, [currentPage, name]);

    // Handle name input separately without triggering API calls
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value)
        setError('') // Clear any previous errors
    }

    // Handle answer selection
    const handleAnswerSelect = (index: number, answer: string | number) => {
        console.log('Selecting answer:', index, answer);
        const newPageAnswers = [...pageAnswers];
        // Convert string numbers to actual numbers for DSE scores
        if (currentPage === 1 && index > 0) {
            newPageAnswers[index] = Number(answer);
        } else {
            newPageAnswers[index] = answer;
        }
        setPageAnswers(newPageAnswers);
        setError('');
    };

    // Modify collectAllAnswers function
    const collectAllAnswers = () => {
        // First 6 answers are name and DSE scores (from page 1)
        const dseAnswers = allAnswers.slice(0, 6);
        
        // Get all yes/no answers from pages 2-6
        const allYesNoAnswers = [
            ...yesNoAnswers,
            ...pageAnswers.map(answer => answer.toString().toLowerCase())
        ];

        return {
            answers: [...dseAnswers, ...allYesNoAnswers],
            dse_scores: dseAnswers.slice(1) // Remove name, keep only scores
        };
    };

    // Modify handlePageSubmit
    const handlePageSubmit = async () => {
        try {
            setIsLoading(true);
            setError('');

            // For page 1, validate name and DSE scores separately
            if (currentPage === 1) {
                // Validate name
                if (!name.trim()) {
                    throw new Error('請輸入你的名字');
                }

                // Validate DSE scores (skip index 0 as it's for name)
                const allScoresValid = pageAnswers.every((score, index) => {
                    if (index === 0) return true; // Skip name field
                    return score !== '' && Number(score) >= 1 && Number(score) <= 7;
                });

                if (!allScoresValid) {
                    throw new Error('請為所有科目輸入1-7分之間的分數');
                }

                // Set answers and submit
                setAllAnswers([name, ...pageAnswers.slice(1)]);
                
                // Submit page 1
                const response = await fetch('http://localhost:8000/submit_survey_page/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_name: name,
                        page_number: currentPage,
                        answers: [name, ...pageAnswers.slice(1)]
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `Failed to submit page ${currentPage}`);
                }
            } else {
                // For pages 2-6, validate all answers are present
                if (!pageAnswers.every(answer => answer !== '')) {
                    throw new Error('請回答所有問題');
                }

                if (currentPage < 6) {
                    // For pages 2-5, store yes/no answers
                    setYesNoAnswers(prev => [...prev, ...pageAnswers.map(answer => answer.toString().toLowerCase())]);
                    
                    // Submit current page
                    const response = await fetch('http://localhost:8000/submit_survey_page/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_name: name,
                            page_number: currentPage,
                            answers: pageAnswers
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || `Failed to submit page ${currentPage}`);
                    }
                }
            }

            // Move to next page (for all non-final pages)
            if (currentPage < 6) {
                setCurrentPage(prev => prev + 1);
                setPageAnswers([]);
                setError('');
                return;
            }

            // Final page submission logic...
            if (currentPage === 6) {
                try {
                    // Validate answers for page 6
                    if (!pageAnswers.every(answer => answer !== '')) {
                        throw new Error('請回答所有問題');
                    }

                    // Add current page answers to yesNoAnswers
                    setYesNoAnswers(prev => [...prev, ...pageAnswers.map(answer => answer.toString().toLowerCase())]);
                    
                    // Set localStorage
                    localStorage.setItem('userName', name);
                    localStorage.setItem('surveyCompleted', 'true');

                    // Collect all answers
                    const allSurveyData = collectAllAnswers();

                    console.log('Submitting final survey with data:', {
                        user_name: name,
                        ...allSurveyData,
                        final_page_answers: pageAnswers
                    });

                    // Submit complete survey
                    const completeResponse = await fetch('http://localhost:8000/submit_survey/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_name: name,
                            answers: [...allSurveyData.answers, ...pageAnswers.map(answer => answer.toString().toLowerCase())],
                            dse_scores: allSurveyData.dse_scores
                        })
                    });

                    if (!completeResponse.ok) {
                        const errorData = await completeResponse.json();
                        throw new Error(errorData.detail || 'Failed to submit survey');
                    }

                    // Navigate to results
                    window.location.href = '/results';
                    return;
                } catch (error) {
                    console.error('Final submission error:', error);
                    localStorage.removeItem('userName');
                    localStorage.removeItem('surveyCompleted');
                    setError(error instanceof Error ? error.message : '提交失敗，請稍後再試');
                }
            }

        } catch (error) {
            console.error('Submission error:', error);
            if (currentPage === 6) {
                localStorage.removeItem('userName');
                localStorage.removeItem('surveyCompleted');
            }
            setError(error instanceof Error ? error.message : '提交失敗，請稍後再試');
        } finally {
            setIsLoading(false);
        }
    };

    const renderQuestion = (question: Question, index: number) => {
        if (!question) return null;

        if (currentPage === 1) {
            if (index === 0) {
                return (
                    <div key={index} className="mb-6">
                        <label className="block text-white mb-2">{question.question}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={handleNameChange}
                            className="w-full p-2 rounded bg-white/10 text-white"
                            placeholder="你的名字"
                        />
                    </div>
                )
            } else {
                return (
                    <div key={index} className="mb-6">
                        <label className="block text-white mb-2">{question.question}</label>
                        <select
                            value={pageAnswers[index] || ''}
                            onChange={(e) => handleAnswerSelect(index, parseInt(e.target.value))}
                            className="w-full p-2 rounded bg-white/10 text-white"
                        >
                            <option value="">選擇分數</option>
                            {[1, 2, 3, 4, 5, 6, 7].map(score => (
                                <option key={score} value={score}>{score}</option>
                            ))}
                        </select>
                    </div>
                )
            }
        } else {
            return (
                <div key={index} className="mb-6">
                    <p className="text-white mb-4">{question.question}</p>
                    <div className="space-x-4">
                        <button
                            onClick={() => handleAnswerSelect(index, 'yes')}
                            className={`px-6 py-2 rounded ${
                                pageAnswers[index] === 'yes' 
                                    ? 'bg-[#3E9BFF] text-white' 
                                    : 'bg-white/10 text-white'
                            }`}
                        >
                            是
                        </button>
                        <button
                            onClick={() => handleAnswerSelect(index, 'no')}
                            className={`px-6 py-2 rounded ${
                                pageAnswers[index] === 'no' 
                                    ? 'bg-[#3E9BFF] text-white' 
                                    : 'bg-white/10 text-white'
                            }`}
                        >
                            否
                        </button>
                    </div>
                </div>
            )
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#002B5B] p-4">
            <div className="max-w-2xl w-full">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white text-center">
                        第 {currentPage} 頁 / 6
                    </h2>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-6">
                            {questions.map((question, index) => renderQuestion(question, index))}
                        </div>

                        <div className="mt-8 flex justify-between">
                            {currentPage > 1 && (
                                <button
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded"
                                    disabled={isLoading}
                                >
                                    上一頁
                                </button>
                            )}
                            <button
                                onClick={handlePageSubmit}
                                className="bg-[#3E9BFF] hover:bg-[#3E9BFF]/90 text-white px-6 py-2 rounded ml-auto"
                                disabled={isLoading}
                            >
                                {currentPage === 6 ? '完成' : '下一頁'}
                            </button>
                        </div>
                    </>
                )}

                {error && (
                    <p className="text-red-500 text-center mt-4">{error}</p>
                )}
            </div>
        </div>
    );
}