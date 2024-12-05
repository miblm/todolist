from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import openai
from pydantic import BaseModel
import os
from dotenv import load_dotenv

from . import models, database

load_dotenv()

app = FastAPI()
openai.api_key = os.getenv("OPENAI_API_KEY")

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
async def generate_tasks(prompt: str, db: Session = Depends(database.get_db)):
    try:
        completion = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": """You are a helpful task planner. Create a list of specific, actionable tasks based on the user's input.
                Format your response as a JSON array of tasks, where each task has:
                - title (string): A short, clear title
                - description (string): A detailed description
                - priority (string): Must be exactly "Low", "Medium", or "High"
                Example format:
                [
                    {
                        "title": "Book flight tickets",
                        "description": "Search and book round-trip flights",
                        "priority": "High"
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
