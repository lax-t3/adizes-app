from pydantic import BaseModel, model_validator
from typing import List, Optional


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
    question_index: int                  # 0-based, 0–35
    ranks: dict[str, int]                # {"a":1,"b":3,"c":4,"d":2} — rank 1=most preferred

    @model_validator(mode="after")
    def validate_ranks(self) -> "AnswerInput":
        keys = set(self.ranks.keys())
        vals = set(self.ranks.values())
        if keys != {"a", "b", "c", "d"}:
            raise ValueError(
                f"ranks must contain exactly keys a,b,c,d — got {sorted(keys)}"
            )
        if vals != {1, 2, 3, 4}:
            raise ValueError(
                f"ranks values must be a permutation of {{1,2,3,4}} — got {sorted(vals)}"
            )
        return self

    @property
    def option_key(self) -> str:
        """Return the rank-1 (most preferred) option key."""
        return next(k for k, v in self.ranks.items() if v == 1)


class SubmitRequest(BaseModel):
    answers: List[AnswerInput]


class SubmitResponse(BaseModel):
    result_id: str
    message: str = "Assessment submitted successfully"
