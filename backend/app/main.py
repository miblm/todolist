from fastapi import FastAPI, HTTPException, Depends, status, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from openai import OpenAI
from pydantic import BaseModel
import os
from dotenv import load_dotenv

from . import models, database

load_dotenv()

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
models.Base.metadata.create_all(bind=database.engine)

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = "Medium"
    category: Optional[str] = None
    tags: Optional[List[str]] = []
    progress: Optional[int] = 0  # Progress percentage (0-100)
    notes: Optional[List[str]] = []

class TaskCreate(TaskBase):
    pass

class Task(TaskBase):
    id: int
    is_completed: bool
    created_at: datetime
    updated_at: datetime
    owner_id: int

    class Config:
        from_attributes = True

@app.post("/tasks/generate", response_model=List[TaskBase])
async def generate_tasks(prompt: str = Body(...), db: Session = Depends(database.get_db)):
    if not prompt or not isinstance(prompt, str):
        raise HTTPException(status_code=422, detail="Invalid prompt format. Expected a string.")
        
    try:
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": """You are a helpful task planner. Create a list of specific, actionable tasks based on the user's input.
                Format your response as a JSON array of tasks, where each task has:
                - title (string): A short, clear title
                - description (string): A detailed description
                - priority (string): Must be exactly "Low", "Medium", or "High"
                - category (string): A relevant category for the task (e.g., "Work", "Personal", "Shopping", "Health", etc.)
                - tags (array of strings): Relevant tags for the task
                - due_date (string, optional): Suggested due date in ISO format (YYYY-MM-DD)
                
                Example format:
                [
                    {
                        "title": "Book flight tickets",
                        "description": "Search and book round-trip flights to Paris",
                        "priority": "High",
                        "category": "Travel",
                        "tags": ["vacation", "booking", "transportation"],
                        "due_date": "2024-03-15"
                    }
                ]"""},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
        )
        
        # Get the response content
        response = completion.choices[0].message.content
        
        # Parse the JSON response into a list of tasks
        import json
        try:
            tasks_data = json.loads(response)
            tasks = []
            for task_data in tasks_data:
                # Validate priority
                if task_data["priority"] not in ["Low", "Medium", "High"]:
                    task_data["priority"] = "Medium"
                
                # Convert due_date string to datetime if present
                if "due_date" in task_data and task_data["due_date"]:
                    try:
                        task_data["due_date"] = datetime.fromisoformat(task_data["due_date"])
                    except ValueError:
                        task_data["due_date"] = None
                
                tasks.append(TaskCreate(**task_data))
            return tasks
        except json.JSONDecodeError:
            # Fallback in case the response is not valid JSON
            return [TaskCreate(
                title="Generated Task",
                description=response,
                priority="Medium"
            )]
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tasks/", response_model=Task)
def create_task(task: TaskCreate, db: Session = Depends(database.get_db)):
    db_task = models.Task(**task.dict(), owner_id=1)  # Hardcoded owner_id for now
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/tasks/", response_model=List[Task])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    tasks = db.query(models.Task).offset(skip).limit(limit).all()
    return tasks

@app.put("/tasks/{task_id}/complete")
def complete_task(task_id: int, db: Session = Depends(database.get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.is_completed = not task.is_completed
    db.commit()
    return {"status": "success"}

@app.get("/tasks/categories")
def get_categories(db: Session = Depends(database.get_db)):
    """Get all unique categories from existing tasks"""
    tasks = db.query(models.Task).all()
    categories = set(task.category for task in tasks if task.category)
    return list(categories)

@app.get("/tasks/search")
def search_tasks(
    q: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    completed: Optional[bool] = None,
    db: Session = Depends(database.get_db)
):
    """Search tasks with various filters"""
    query = db.query(models.Task)
    
    if q:
        query = query.filter(
            (models.Task.title.ilike(f"%{q}%")) |
            (models.Task.description.ilike(f"%{q}%"))
        )
    if category:
        query = query.filter(models.Task.category == category)
    if priority:
        query = query.filter(models.Task.priority == priority)
    if completed is not None:
        query = query.filter(models.Task.is_completed == completed)
        
    return query.all()

@app.post("/tasks/{task_id}/notes")
def add_task_note(
    task_id: int,
    note: str = Body(...),
    db: Session = Depends(database.get_db)
):
    """Add a note to a task"""
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not task.notes:
        task.notes = []
    task.notes.append(note)
    db.commit()
    return {"status": "success"}

@app.put("/tasks/{task_id}/progress")
def update_task_progress(
    task_id: int,
    progress: int = Body(...),
    db: Session = Depends(database.get_db)
):
    """Update task progress percentage"""
    if not 0 <= progress <= 100:
        raise HTTPException(status_code=400, detail="Progress must be between 0 and 100")
        
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.progress = progress
    db.commit()
    return {"status": "success"}

@app.get("/tasks/{task_id}/assistance")
async def get_task_assistance(task_id: int, db: Session = Depends(database.get_db)):
    """Get AI-generated assistance and resources for completing a task"""
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    try:
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": """You are a helpful task assistant. Provide practical suggestions, 
                resources, and steps for completing the given task. Include:
                1. A brief step-by-step guide
                2. Useful online resources (websites, tools, apps)
                3. Tips and best practices
                4. Estimated time to complete
                
                Format your response as JSON with the following structure:
                {
                    "steps": [{"step": 1, "description": "..."}],
                    "resources": [{"title": "...", "url": "...", "description": "..."}],
                    "tips": ["..."],
                    "estimated_time": "... (e.g., '2 hours', '3 days')",
                    "difficulty_level": "Easy|Medium|Hard"
                }"""},
                {"role": "user", "content": f"Provide assistance for the task: {task.title}\nDescription: {task.description or ''}"}
            ],
            temperature=0.7,
        )
        
        response = completion.choices[0].message.content
        
        # Parse the JSON response
        import json
        try:
            assistance_data = json.loads(response)
            return assistance_data
        except json.JSONDecodeError:
            return {
                "steps": [{"step": 1, "description": response}],
                "resources": [],
                "tips": [],
                "estimated_time": "Unknown",
                "difficulty_level": "Medium"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/tasks/{task_id}", response_model=Task)
def update_task(task_id: int, task_update: TaskCreate, db: Session = Depends(database.get_db)):
    """Update an existing task"""
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    for field, value in task_update.dict(exclude_unset=True).items():
        setattr(db_task, field, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(database.get_db)):
    """Delete a task"""
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(db_task)
    db.commit()
    return {"status": "success"}

@app.post("/tasks/{task_id}/subtasks", response_model=List[Task])
async def create_subtasks(task_id: int, db: Session = Depends(database.get_db)):
    """Generate and create subtasks for a given task"""
    parent_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not parent_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    try:
        # Use OpenAI to generate subtasks
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": """You are a task breakdown expert. Break down the given task into smaller, 
                manageable subtasks. Each subtask should be specific and actionable.
                Format your response as a JSON array of tasks, where each task has:
                - title (string): A clear, concise title
                - description (string): A detailed description
                - priority (string): Must be exactly "Low", "Medium", or "High"
                
                Example format:
                [
                    {
                        "title": "Research flight options",
                        "description": "Compare prices and schedules from different airlines",
                        "priority": "High"
                    }
                ]"""},
                {"role": "user", "content": f"Break down this task into subtasks: {parent_task.title}\nDescription: {parent_task.description or ''}"}
            ],
            temperature=0.7,
        )
        
        response = completion.choices[0].message.content
        
        # Parse the JSON response and create subtasks
        import json
        try:
            subtasks_data = json.loads(response)
            created_subtasks = []
            
            for subtask_data in subtasks_data:
                # Inherit certain properties from parent
                subtask_data["category"] = parent_task.category
                subtask_data["due_date"] = parent_task.due_date
                subtask_data["owner_id"] = parent_task.owner_id
                subtask_data["parent_id"] = parent_task.id
                
                # Create the subtask
                db_subtask = models.Task(**subtask_data)
                db.add(db_subtask)
                created_subtasks.append(db_subtask)
            
            db.commit()
            
            # Refresh all subtasks to get their IDs
            for subtask in created_subtasks:
                db.refresh(subtask)
            
            return created_subtasks
            
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks/{task_id}/subtasks", response_model=List[Task])
def get_subtasks(task_id: int, db: Session = Depends(database.get_db)):
    """Get all subtasks for a given task"""
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task.subtasks
