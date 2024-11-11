from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Union, Optional, Any
import yaml
import random
from fastapi.middleware.cors import CORSMiddleware
from itertools import permutations
from openai import OpenAI
import os
import json
from datetime import datetime
from dotenv import load_dotenv
import numpy as np

load_dotenv()
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

class SurveyPageResponse(BaseModel):
    user_name: str
    page_number: int
    answers: List[Union[str, int]]

class SurveyResponse(BaseModel):
    user_name: str
    answers: List[Union[str, int, float]]  # All answers including name, DSE scores, and yes/no
    dse_scores: List[Union[int, float]]    # Just the DSE scores

class ChatMessage(BaseModel):
    message: str
    preset_question: Optional[int] = None



# Load question pools and industry mapping from YAML files
try:
    with open('questions_pool.yaml', 'r', encoding='utf-8') as file:
        QUESTIONS_POOL = yaml.safe_load(file)["questions"]
    with open('industry_mapping.yaml', 'r', encoding='utf-8') as file:
        INDUSTRY_MAPPING = yaml.safe_load(file)
    with open('jupas.yaml', 'r', encoding='utf-8') as file:
        JUPAS_DATA = yaml.safe_load(file)
except Exception as e:
    print(f"Error loading YAML files: {e}")
    QUESTIONS_POOL = []
    INDUSTRY_MAPPING = {}
    JUPAS_DATA = {}

# Store user responses temporarily (in production, use a database)
USER_RESPONSES = {}

def generate_code(max_categories, second_max_categories, third_max_categories):
    """Generate OnTrack code"""
    if len(max_categories) == 2:
        permutations_result = [''.join(p) + second_max_categories[0] for p in permutations(max_categories, 2)]
        return " / ".join(permutations_result)
    elif len(max_categories) >= 3:
        permutations_result = [''.join(p) for p in permutations(max_categories, 3)]
        return " / ".join(permutations_result)
    elif len(max_categories) == 1:
        if len(second_max_categories) >= 2:
            permutations_result = [max_categories[0] + ''.join(p) for p in permutations(second_max_categories[0:], 2)]
            return " / ".join(permutations_result)
        elif len(second_max_categories) == 1 and len(third_max_categories) >= 2:
            permutations_result = [max_categories[0] + second_max_categories[0] + ''.join(p) for p in permutations(third_max_categories, 1)]
            return " / ".join(permutations_result)
        else:
            return max_categories[0] + second_max_categories[0] + third_max_categories[0]
    else:
        return max_categories[0] + second_max_categories[0] + third_max_categories[0]

@app.get("/get_survey_page/{page_number}")
async def get_survey_page(page_number: int, user_name: Optional[str] = None):
    """Get questions for a specific page of the survey"""
    if page_number == 1:
        return {
            "questions": [
                {"type": "text", "question": "Please enter your name."},
                {"type": "score", "question": "DSE Chinese predicted score (1-7)"},
                {"type": "score", "question": "DSE English predicted score (1-7)"},
                {"type": "score", "question": "DSE Mathematics predicted score (1-7)"},
                {"type": "score", "question": "DSE Elective 1 predicted score (1-7)"},
                {"type": "score", "question": "DSE Elective 2 predicted score (1-7)"}
            ]
        }
    elif 2 <= page_number <= 5:
        if not user_name:
            raise HTTPException(status_code=400, detail="User name is required for pages 2-5")
            
        # Initialize user's data if not exists
        if user_name not in USER_RESPONSES:
            USER_RESPONSES[user_name] = {
                'answers': [],
                'used_questions': set()  # Track used question indices
            }
            
        user_data = USER_RESPONSES[user_name]
        used_questions = user_data.get('used_questions', set())
        
        # Get available questions (those not used yet)
        available_questions = [
            (i, q) for i, q in enumerate(QUESTIONS_POOL)
            if i not in used_questions
        ]
        
        if len(available_questions) < 10:
            raise HTTPException(
                status_code=400,
                detail="Not enough unique questions remaining"
            )
            
        # Randomly select 10 unused questions
        selected_questions = random.sample(available_questions, 10)
        
        # Update used questions
        for idx, _ in selected_questions:
            used_questions.add(idx)
        USER_RESPONSES[user_name]['used_questions'] = used_questions
        
        # Format questions for response
        questions = [
            {
                "question": q["question"],
                "category": q["category"]
            }
            for _, q in selected_questions
        ]
        
        return {"questions": questions}
    elif page_number == 6:
        if not user_name:
            raise HTTPException(status_code=400, detail="User name is required for page 6")
            
        if user_name not in USER_RESPONSES:
            raise HTTPException(status_code=400, detail="No previous responses found for this user")

        user_data = USER_RESPONSES.get(user_name, {})
        user_answers = user_data.get('answers', [])
        
        if not user_answers:
            raise HTTPException(status_code=400, detail="No answers found for this user")

        # Calculate category counts
        category_counts = {"R": 0, "A": 0, "S": 0, "C": 0, "I": 0, "E": 0}
        
        for i, answer in enumerate(user_answers):
            if answer and str(answer).lower() == "yes":
                question_idx = i % len(QUESTIONS_POOL)
                category = QUESTIONS_POOL[question_idx]["category"]
                category_counts[category] += 1

        # Sort categories by count
        sorted_categories = sorted(
            category_counts.items(),
            key=lambda x: (x[1], x[0]),  # Sort by count first, then alphabetically
            reverse=True
        )

        # Get categories for code generation
        max_count = sorted_categories[0][1]
        second_max_count = sorted_categories[1][1]
        third_max_count = sorted_categories[2][1]

        # Group categories by their counts
        max_categories = [cat for cat, count in sorted_categories if count == max_count]
        second_max_categories = [cat for cat, count in sorted_categories if count == second_max_count]
        third_max_categories = [cat for cat, count in sorted_categories if count == third_max_count]

        # Generate holland code using the improved function
        holland_code = generate_code(max_categories, second_max_categories, third_max_categories)

        # Store the first code if multiple are generated
        primary_code = holland_code.split(' / ')[0]
        USER_RESPONSES[user_name]['holland_code'] = primary_code

        # Get matching industries for ALL possible codes
        matching_industries = set()  # Use set to avoid duplicates
        for code in holland_code.split(' / '):
            for mapping in INDUSTRY_MAPPING:
                if 'holland_codes' in mapping and 'industry' in mapping:
                    if code in mapping['holland_codes']:
                        matching_industries.add(mapping['industry'])

        matching_industries = list(matching_industries)  # Convert back to list
        USER_RESPONSES[user_name]['matching_industries'] = matching_industries
        USER_RESPONSES[user_name]['all_holland_codes'] = holland_code  # Store all possible codes

        return {
            "questions": [
                {"question": f"Would you consider a career in {industry}?"}
                for industry in matching_industries
            ],
            "holland_codes": holland_code  # Return all possible codes
        }

    else:
        raise HTTPException(status_code=400, detail="Invalid page number")

@app.post("/submit_survey_page/")
async def submit_survey_page(response: SurveyPageResponse):
    """Submit answers for a specific page"""
    try:
        # Store responses in memory (in production, use a database)
        if response.user_name not in USER_RESPONSES:
            USER_RESPONSES[response.user_name] = {'answers': []}
        
        if response.page_number == 1:
            if len(response.answers) != 6:
                raise HTTPException(status_code=400, detail="Invalid number of answers for page 1")
            USER_RESPONSES[response.user_name]['basic_info'] = response.answers
        elif 2 <= response.page_number <= 5:
            start_idx = (response.page_number - 2) * 10
            USER_RESPONSES[response.user_name]['answers'][start_idx:start_idx + 10] = response.answers
        elif response.page_number == 6:
            USER_RESPONSES[response.user_name]['final_answers'] = response.answers
            
        return {"status": "success", "page": response.page_number}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


USER_RESPONSES = {}

@app.post("/submit_survey/")
async def submit_survey(response: SurveyResponse):
    try:
        # Basic validation
        if not response.user_name:
            raise HTTPException(status_code=400, detail="Username is required")
        
        # Calculate Holland codes from answers
        yes_no_answers = response.answers[6:]  # Skip name and DSE scores
        
        # Initialize category counts
        category_counts = {"R": 0, "I": 0, "A": 0, "S": 0, "E": 0, "C": 0}
        
        # Count 'yes' answers for each category
        for i, answer in enumerate(yes_no_answers):
            if str(answer).lower() == 'yes' and i < len(QUESTIONS_POOL):
                category = QUESTIONS_POOL[i].get('category')
                if category in category_counts:
                    category_counts[category] += 1

        # Sort categories by count to get Holland codes
        sorted_categories = sorted(
            category_counts.items(), 
            key=lambda x: (-x[1], x[0])  # Sort by count (descending) then by letter
        )
        
        # Generate Holland code string (top 3)
        holland_codes = ''.join(cat for cat, _ in sorted_categories[:3])
        
        # Find matching industries
        matching_industries = []
        for industry in INDUSTRY_MAPPING:
            if 'holland_codes' in industry and any(code in industry['holland_codes'] for code in holland_codes):
                if 'industry' in industry:
                    matching_industries.append(industry['industry'])

        if not matching_industries:
            # If no exact matches, use the first code as fallback
            for industry in INDUSTRY_MAPPING:
                if 'holland_codes' in industry and holland_codes[0] in industry['holland_codes']:
                    if 'industry' in industry:
                        matching_industries.append(industry['industry'])

        # Ensure we have at least some industries
        if not matching_industries:
            matching_industries = ["General"]  # Fallback industry

        # Store the complete response
        user_data = {
            "timestamp": datetime.now().isoformat(),
            "answers": response.answers,
            "dse_scores": response.dse_scores,
            "holland_codes": holland_codes,
            "matching_industries": matching_industries
        }

        # Save to file
        try:
            with open('survey_responses.json', 'r', encoding='utf-8') as f:
                stored_responses = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            stored_responses = {}

        stored_responses[response.user_name] = user_data

        with open('survey_responses.json', 'w', encoding='utf-8') as f:
            json.dump(stored_responses, f, ensure_ascii=False, indent=2)

        return {
            "status": "success",
            "message": "Survey completed successfully",
            "user_name": response.user_name,
            "holland_codes": holland_codes,
            "matching_industries": matching_industries
        }

    except Exception as e:
        print(f"Error processing survey: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get_survey_results/{user_name}")
async def get_survey_results(user_name: str):
    """Get stored survey results for a user"""
    try:
        if user_name not in USER_RESPONSES:
            # Try to load from JSON file
            try:
                with open('survey_responses.json', 'r') as f:
                    stored_responses = json.load(f)
                    if user_name in stored_responses:
                        return stored_responses[user_name]
            except (FileNotFoundError, json.JSONDecodeError):
                pass
            
            raise HTTPException(status_code=404, detail="User not found")
        
        return USER_RESPONSES[user_name]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# For testing the API
@app.get("/")
async def root():
    return {"message": "Survey API is running"}

async def generate_career_paths(holland_code: str, matching_industries: List[str]) -> Dict:
    """Generate 10 specific career paths using OpenAI API"""
    try:
        prompt = f"""
        Based on the following information:
        - Holland Code: {holland_code}
        - Matching Industries: {', '.join(matching_industries)}

        Please provide 5 specific career paths that match this profiles. For each career path:
        1. Job Title
        2. Detailed job description
        3. Required skills
        4. Education requirements
        5. Career progression

        Format each career path with // as separators.
        Example format:
        Job Title: Software Engineer
        Description: A Software Engineer designs, develops, and maintains computer software and systems. They use programming languages like Python, Java, or C++ to create applications that solve problems or enhance user experiences. Beyond coding, software engineers also debug issues, test software functionality, and collaborate with other team members to ensure a product meets user needs. This career demands strong analytical thinking, problem-solving skills, and continuous learning to adapt to evolving technologies and build innovative digital solutions..
        Required Skills: Programming languages (Python, Java), problem-solving, teamwork
        Education: Bachelor's degree in Computer Science or related field; Relevant Courses or Certifications in programming, algorithms, and software development can also be helpful.
        Career Progression: Junior Developer → Senior Developer → Tech Lead → Software Architect
        //
        [Next career path...]
        """

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a career counselor specializing in Holland Code career matching. Provide detailed and specific career paths."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=6000,
            temperature=0.7
        )

        # Access the message content correctly
        content = response.choices[0].message.content

        # Split the response into individual career paths
        career_paths = content.split('//')
        
        # Clean and structure each career path
        structured_paths = []
        for path in career_paths:
            if path.strip():  # Skip empty paths
                path_dict = {}
                lines = path.strip().split('\n')
                for line in lines:
                    if line.strip():
                        if "Job Title:" in line:
                            path_dict['title'] = line.replace("Job Title:", "").strip()
                        elif "Description:" in line:
                            path_dict['description'] = line.replace("Description:", "").strip()
                        elif "Required Skills:" in line:
                            path_dict['required_skills'] = line.replace("Required Skills:", "").strip()
                        elif "Education:" in line:
                            path_dict['education'] = line.replace("Education:", "").strip()
                        elif "Career Progression:" in line:
                            path_dict['progression'] = line.replace("Career Progression:", "").strip()
                if path_dict:  # Only append if we parsed some data
                    structured_paths.append(path_dict)
        
        return {
            "career_paths": structured_paths,
            "total_paths": len(structured_paths)
        }
    except Exception as e:
        print(f"Error in generate_career_paths: {str(e)}")  # Add debugging
        raise HTTPException(status_code=500, detail=f"Error generating career paths: {str(e)}")

# Add new endpoint to get career paths
@app.get("/get_career_paths/{user_name}")
async def get_career_paths(user_name: str):
    """Get specific career paths for a user"""
    try:
        # Load user data from file
        try:
            with open('survey_responses.json', 'r', encoding='utf-8') as f:
                stored_responses = json.load(f)
                user_data = stored_responses.get(user_name)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Error reading survey_responses.json: {str(e)}")
            raise HTTPException(
                status_code=404,
                detail="Survey data not found or corrupted"
            )

        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")

        # Get holland codes and matching industries
        holland_codes = user_data.get('holland_codes', '')
        if not holland_codes:
            raise HTTPException(
                status_code=400,
                detail="Holland codes not found in user data"
            )

        matching_industries = user_data.get('matching_industries', [])
        if not matching_industries:
            raise HTTPException(
                status_code=400,
                detail="No matching industries found"
            )

        # Generate career paths using the holland code
        career_paths_data = await generate_career_paths(holland_codes, matching_industries)

        return {
            "user_name": user_name,
            "holland_codes": holland_codes,
            "matching_industries": matching_industries,
            "career_paths": career_paths_data["career_paths"],
            "total_paths": career_paths_data["total_paths"]
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_career_paths: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting career paths: {str(e)}"
        )

    
def find_closest_program(target_score: float, programs: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Find the program with the closest median score to target score"""
    if not programs:
        return None
        
    min_diff = float('inf')
    closest_program = None
    
    for program in programs:
        try:
            median_score = program.get('median_score_index')
            if median_score is None or median_score == '/':
                continue
                
            median_score = float(median_score)
            diff = abs(median_score - target_score)
            
            if diff < min_diff:
                min_diff = diff
                closest_program = program
        except (ValueError, TypeError):
            continue
    
    return closest_program

@app.get("/get_jupas_recommendations/{user_name}")
async def get_jupas_recommendations(user_name: str):
    """Get JUPAS recommendations based on survey results"""
    try:
        # Load user data
        try:
            with open('survey_responses.json', 'r', encoding='utf-8') as f:
                stored_responses = json.load(f)
                user_data = stored_responses.get(user_name)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Error reading survey_responses.json: {str(e)}")
            raise HTTPException(
                status_code=404,
                detail="Survey data not found or corrupted"
            )

        if not user_data:
            raise HTTPException(
                status_code=404,
                detail="User not found in survey responses"
            )
        
        # Validate and extract DSE scores
        dse_scores = user_data.get('dse_scores')
        if not dse_scores:
            raise HTTPException(
                status_code=400,
                detail="DSE scores not found in user data"
            )

        # Validate each DSE score
        valid_scores = []
        for i, score in enumerate(dse_scores):
            try:
                score_value = float(score)
                if not (1 <= score_value <= 7):
                    raise HTTPException(
                        status_code=400,
                        detail=f"DSE score must be between 1 and 7, got {score_value} for subject {i+1}"
                    )
                valid_scores.append(score_value)
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid DSE score format for subject {i+1}: {score}"
                )

        if len(valid_scores) != 5:
            raise HTTPException(
                status_code=400,
                detail=f"Expected 5 DSE scores, got {len(valid_scores)}"
            )
            
        # Calculate average score
        average_score = sum(valid_scores) / len(valid_scores)
        
        # Get and validate matching industries
        matching_industries = user_data.get('matching_industries', [])
        if not matching_industries:
            raise HTTPException(
                status_code=400,
                detail="No matching industries found in user data"
            )

        # Get recommendations for each matching industry
        recommendations = []
        for industry in matching_industries:
            if industry in JUPAS_DATA:
                programs = JUPAS_DATA[industry]
                if not programs:
                    continue
                
                # Find closest program for this industry
                closest_program = find_closest_program(average_score, programs)
                if closest_program:
                    score_diff = abs(float(closest_program['median_score_index']) - average_score)
                    recommendations.append({
                        "industry": industry,
                        "program": closest_program,
                        "score_difference": round(score_diff, 2)
                    })

        if not recommendations:
            return {
                "user_name": user_name,
                "average_dse_score": round(average_score, 2),
                "matching_industries": matching_industries,
                "recommendations": [],
                "message": "No matching JUPAS programs found for your profile"
            }
        
        # Sort recommendations by score difference
        recommendations.sort(key=lambda x: x['score_difference'])
        
        return {
            "user_name": user_name,
            "average_dse_score": round(average_score, 2),
            "matching_industries": matching_industries,
            "recommendations": recommendations
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in get_jupas_recommendations: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while getting JUPAS recommendations"
        )

    
@app.get("/get_emerging_careers/{user_name}")
async def get_emerging_careers(
    user_name: str, 
    favorite_sport: str,
    passionate_activity: str,
    billionaire_purchase: str
):
    """Generate emerging career recommendations based on user profile and preferences"""
    try:
        # Load user data from JSON file
        try:
            with open('survey_responses.json', 'r', encoding='utf-8') as f:
                stored_responses = json.load(f)
                user_data = stored_responses.get(user_name)
        except (FileNotFoundError, json.JSONDecodeError):
            raise HTTPException(status_code=404, detail="Survey responses file not found or corrupted")

        if not user_data:
            raise HTTPException(status_code=404, detail="User not found in survey responses")

        # Extract required data
        holland_codes = user_data.get('all_holland_codes', '').split(' / ')
        dse_scores = user_data.get('dse_scores', [])
        matching_industries = user_data.get('matching_industries', [])

        if not holland_codes or not dse_scores or not matching_industries:
            raise HTTPException(
                status_code=400,
                detail="Missing required user data in survey responses"
            )

        # Calculate average DSE score
        avg_dse_score = sum(dse_scores) / len(dse_scores)

        # Create prompt for GPT
        prompt = f"""
        Based on the following user profile and preferences:

        Professional Profile:
        - Holland Code: {holland_codes[0]} (Primary personality type)
        - Academic Performance: DSE Average Score of {avg_dse_score:.1f}/7
        - Industry Matches: {', '.join(matching_industries)}

        Personal Interests & Values:
        - Favorite Sport: {favorite_sport}
        - Activity they're passionate about: {passionate_activity}
        - First purchase as a billionaire: {billionaire_purchase}

        Please suggest 10 emerging or future-oriented career paths (In Traditional Chinese) that:
        1. Align with their Holland Code personality type
        2. Match their interests and values
        3. Are considered emerging or future industries (2024 and beyond)
        4. Take into account their academic performance level

        For each career path, provide:
        1. Job Title (emerging/future role)
        2. Detailed description of the role
        3. Key skills required
        4. Education path recommendation
        5. Future growth potential

        Format each career with // as separators.
        Example format:
        Job Title: Metaverse Experience Designer
        Description: A Metaverse Experience Designer creates immersive digital environments and interactions within virtual worlds. They blend skills in design, user experience (UX), and storytelling to craft engaging, interactive experiences that draw users into the metaverse. This role involves building virtual spaces, integrating avatars, and developing user journeys to ensure a compelling experience. Designers work with VR/AR tools, 3D modeling, and collaborate across disciplines to build vibrant, memorable experiences that make virtual worlds feel alive and engaging for users.
        Required Skills: VR/AR development, 3D modeling, user psychology, spatial design
        Education: Bachelor's in Digital Design, Interactive Media, or related field
        Growth Potential: The role of a Metaverse Experience Designer has immense growth potential as VR and AR technologies expand rapidly. The demand for skilled designers to craft immersive experiences in the metaverse is rising as industries like entertainment, retail, education, and healthcare explore virtual spaces. Meta (formerly Facebook), for example, has been heavily investing in metaverse development and actively seeks talent for positions like "Metaverse Experience Designer." As adoption grows, designers will shape how people socialize, learn, and work in these spaces. Opportunities for specialization, such as gamified education or virtual commerce, create diverse pathways to innovate and redefine user experiences.
        //
        [Next career...]
        """

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an experienced career advisor specializing in emerging industries and future job markets in Hong Kong."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=8000,
            temperature=0.7
        )

        # Parse the response
        content = response.choices[0].message.content
        career_paths = content.split('//')
        
        structured_paths = []
        for path in career_paths:
            if path.strip():
                path_dict = {}
                lines = path.strip().split('\n')
                for line in lines:
                    if line.strip():
                        if "Job Title:" in line:
                            path_dict['title'] = line.replace("Job Title:", "").strip()
                        elif "Description:" in line:
                            path_dict['description'] = line.replace("Description:", "").strip()
                        elif "Required Skills:" in line:
                            path_dict['required_skills'] = line.replace("Required Skills:", "").strip()
                        elif "Education:" in line:
                            path_dict['education'] = line.replace("Education:", "").strip()
                        elif "Growth Potential:" in line:
                            path_dict['growth_potential'] = line.replace("Growth Potential:", "").strip()
                if path_dict:
                    structured_paths.append(path_dict)

        return {
            "user_name": user_name,
            "holland_code": holland_codes[0],
            "dse_average": round(avg_dse_score, 1),
            "matching_industries": matching_industries,
            "personal_interests": {
                "favorite_sport": favorite_sport,
                "passionate_activity": passionate_activity,
                "billionaire_purchase": billionaire_purchase
            },
            "emerging_careers": structured_paths,
            "total_paths": len(structured_paths)
        }

    except Exception as e:
        print(f"Error in get_emerging_careers: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating emerging careers: {str(e)}"
        )

@app.get("/get_personality_analysis/{user_name}")
async def get_personality_analysis(user_name: str):
    """Generate personality analysis based on Holland Code"""
    try:
        # Load user data
        try:
            with open('survey_responses.json', 'r', encoding='utf-8') as f:
                stored_responses = json.load(f)
                user_data = stored_responses.get(user_name)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            raise HTTPException(
                status_code=404,
                detail="Survey data not found or corrupted"
            )

        if not user_data:
            raise HTTPException(
                status_code=404,
                detail="User not found in survey responses"
            )

        # Get Holland Codes and other data
        holland_codes = user_data.get('all_holland_codes', '').split(' / ')
        matching_industries = user_data.get('matching_industries', [])
        category_scores = user_data.get('category_scores', {})

        if not holland_codes:
            raise HTTPException(
                status_code=400,
                detail="Holland codes not found in user data"
            )

        # Create prompt for GPT
        prompt = f"""
        Based on the following user profile:
        - Primary Holland Code: {holland_codes[0]}
        - All Possible Codes: {', '.join(holland_codes)}
        - Matching Industries: {', '.join(matching_industries)}
        - Category Scores: {category_scores}

        Please provide a detailed personality analysis (Do not mention the word "Holland Code" in your resposne) in Traditional Chinese (around 300-400 words) that includes:
        1. A brief explanation of their Holland Code personality type
        2. Their key strengths and potential areas for development
        3. Recommended academic paths Suggested roles in group academic activities or projects
        4. Tips for personal and professional development

        Format the response in these sections:
        性格特質：
        [Content]

        學術發展建議：
        [Content]
        """

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a career counselor specializing in Holland Code analysis."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1500,
            temperature=0.7
        )

        analysis = response.choices[0].message.content

        return {
            "user_name": user_name,
            "holland_codes": holland_codes,
            "analysis": analysis
        }

    except Exception as e:
        print(f"Error in get_personality_analysis: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating personality analysis: {str(e)}"
        )


@app.post("/chat/{user_name}")
async def chat_with_bot(user_name: str, chat_input: ChatMessage):  # Removed async
    """Chat with the career counseling bot"""
    try:
        # Load user data
        try:
            with open('survey_responses.json', 'r', encoding='utf-8') as f:
                stored_responses = json.load(f)
                user_data = stored_responses.get(user_name)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Error reading survey_responses.json: {str(e)}")
            raise HTTPException(
                status_code=404,
                detail="Survey data not found"
            )

        if not user_data:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        # Get user profile data
        holland_code = user_data.get('holland_code', '')
        all_holland_codes = user_data.get('all_holland_codes', '')
        matching_industries = user_data.get('matching_industries', [])
        dse_scores = user_data.get('dse_scores', [])
        category_scores = user_data.get('category_scores', {})

        # Validate required data
        if not all([holland_code, matching_industries, dse_scores]):
            raise HTTPException(
                status_code=400,
                detail="Missing required user data"
            )

        # Calculate average DSE score safely
        try:
            avg_dse_score = sum(float(score) for score in dse_scores) / len(dse_scores)
        except (TypeError, ValueError, ZeroDivisionError):
            raise HTTPException(
                status_code=400,
                detail="Invalid DSE scores"
            )

        # Process message or preset question
        message = chat_input.message
        preset_question = chat_input.preset_question

        # Define preset questions
        preset_questions = {
            1: f"""基於你的Holland Code ({holland_code})和性格特質分數：
               {category_scores}
               請分析我應該發展的技能：
               1. 核心技能
               2. 輔助技能
               3. 未來發展潛力
               4. 實際行動建議""",
            
            2: f"""關於這些適合我性格的行業：
               {', '.join(matching_industries)}
               請分析：
               1. 行業特點和發展趨勢
               2. 入行要求和準備工作
               3. 職業發展路徑
               4. 相關進修建議""",
            
            3: f"""基於我的Holland Code組合 ({all_holland_codes})，
               建議我參與什麼課外活動？
               請從以下角度分析：
               1. 領導才能發展
               2. 專業技能提升
               3. 人際網絡建立
               4. 實戰經驗累積""",
            
            4: f"""關於我的JUPAS選科（DSE預計平均分：{round(avg_dse_score, 2)}）：
               1. 現有成績分析
               2. 提升競爭力建議
               3. 備選方案規劃
               4. 面試準備策略"""
        }

        # Handle preset question
        if preset_question:
            if preset_question not in preset_questions:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid preset question number"
                )
            message = preset_questions[preset_question]

        # Validate message
        if not message or not message.strip():
            raise HTTPException(
                status_code=400,
                detail="Message cannot be empty"
            )

        # Create chat prompt
        prompt = f"""
        用戶資料：
        - Holland Code: {holland_code}
        - Holland Code組合: {all_holland_codes}
        - 匹配行業: {', '.join(matching_industries)}
        - DSE平均分: {round(avg_dse_score, 2)}
        - 性格特質分數: {category_scores}

        用戶問題：{message}

        請提供詳細回應(Do not mention the word "Holland Code" in your resposne)，要求：
        1. 針對用戶情況
        2. 提供可行建議
        3. 保持鼓勵支持
        4. 重點清晰
        5. 具體可行

        回應格式：
        分析：
        [分析內容]

        建議：
        [建議內容]

        行動計劃：
        [具體步驟]
        """

        # Call OpenAI API
        try:
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system", 
                        "content": """You are a professional career counselor who:
                        1. Has deep knowledge of Holland Codes and career development
                        2. Thinks with both entrepreneurial and creative mindsets
                        3. Provides logical and structured advice
                        4. Always responds in Traditional Chinese
                        5. Focuses on practical and actionable suggestions"""
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.7
            )

            if not response.choices:
                raise HTTPException(
                    status_code=500,
                    detail="No response generated"
                )

            return {
                "status": "success",
                "response": response.choices[0].message.content,
                "preset_question": preset_question
            }

        except Exception as e:
            print(f"OpenAI API error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error generating response: {str(e)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )