import sqlite3
from pathlib import Path
from langgraph.checkpoint.sqlite import SqliteSaver

DB_PATH = Path("research_checkpoints.db")


def make_checkpointer() -> SqliteSaver:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    return SqliteSaver(conn)


def make_config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def get_checkpoint_history(graph, config: dict) -> list[dict]:
    history = []
    for state in graph.get_state_history(config):
        history.append({
            "step": state.metadata.get("step", 0),
            "node": state.metadata.get("source", "unknown"),
            "next": list(state.next or []),
        })
    return history
