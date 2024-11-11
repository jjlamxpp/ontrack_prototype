const API_BASE_URL = 'http://127.0.0.1:8000/';

export const surveyApi = {
  // Get questions for a specific page
  getPageQuestions: async (pageNumber: number, userName?: string) => {
    const url = `${API_BASE_URL}/get_survey_page/${pageNumber}`;
    const response = await fetch(url + (userName ? `?user_name=${userName}` : ''));
    if (!response.ok) throw new Error('Failed to fetch questions');
    return response.json();
  },

  // Submit answers for a specific page
  submitPageAnswers: async (pageNumber: number, userName: string, answers: any[]) => {
    const response = await fetch(`${API_BASE_URL}/submit_survey_page/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_name: userName,
        page_number: pageNumber,
        answers: answers,
      }),
    });
    if (!response.ok) throw new Error('Failed to submit answers');
    return response.json();
  },

  // Submit complete survey
  submitCompleteSurvey: async (userName: string, answers: any[]) => {
    const response = await fetch(`${API_BASE_URL}/submit_survey/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_name: userName,
        answers: answers,
      }),
    });
    if (!response.ok) throw new Error('Failed to submit survey');
    return response.json();
  },
};