from pydantic import BaseModel
from typing import List


class Option(BaseModel):
    key: str          # 'a', 'b', 'c', 'd'
    text: str
    paei_role: str    # 'P', 'A', 'E', 'I'


class Question(BaseModel):
    id: str
    question_index: int   # 0-based, 0–35
    text: str
    options: List[Option]


class Section(BaseModel):
    name: str             # 'is', 'should', 'want'
    label: str            # 'Is', 'Should', 'Want'
    description: str
    questions: List[Question]


class QuestionsResponse(BaseModel):
    sections: List[Section]


class AnswerInput(BaseModel):
    question_index: int   # 0-based
    option_key: str       # 'a', 'b', 'c', 'd'


class SubmitRequest(BaseModel):
    answers: List[AnswerInput]


class SubmitResponse(BaseModel):
    result_id: str
    message: str = "Assessment submitted successfully"
