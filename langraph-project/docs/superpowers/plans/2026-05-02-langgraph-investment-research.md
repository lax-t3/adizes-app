# Investment Research Brief — LangGraph Multi-Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Streamlit multi-agent investment research assistant using LangGraph that demonstrates typed state, conditional routing, parallel fan-out, SQLite checkpointing, and human-in-the-loop patterns through a live investment brief workflow.

**Architecture:** A `StateGraph` with 9 nodes — Supervisor → Planner → conditional Router → [Fundamentals | (News + Risk parallel)] → Merger → Synthesizer → review_gate (HITL interrupt) → Finalizer. Compiled with `SqliteSaver` and `interrupt_before=["review_gate"]`. The Streamlit UI shows one concept card per active node explaining the LangGraph primitive being demonstrated.

**Tech Stack:** Python 3.11 · `langgraph>=0.2` · `anthropic>=0.49` (raw SDK, no langchain) · `yfinance>=0.2` · `duckduckgo-search>=6.0` · `streamlit>=1.40` · `python-dotenv>=1.0` · `pytest>=8.0`

**Spec:** `docs/superpowers/specs/2026-05-02-langgraph-investment-research-design.md`

---

## File Map

```
langraph-project/
├── main.py                       # Streamlit entry point
├── state.py                      # ResearchState TypedDict + initial_state()
├── graph/
│   ├── __init__.py
│   ├── builder.py                # StateGraph construction + compile()
│   └── router.py                 # route_after_planner, route_after_review
├── agents/
│   ├── __init__.py
│   ├── supervisor.py             # regex ticker extraction
│   ├── planner.py                # Claude Haiku → plan + complexity
│   ├── fundamentals.py           # yfinance → fundamentals dict
│   ├── news.py                   # DuckDuckGo → news_data list
│   ├── risk.py                   # DuckDuckGo → risk_data list
│   ├── merger.py                 # combines research fields → merged_research
│   ├── synthesizer.py            # Claude Sonnet → draft_brief
│   ├── review_gate.py            # trivial interrupt target: return {}
│   └── finalizer.py              # formats final_brief
├── tools/
│   ├── __init__.py
│   ├── yfinance_tool.py          # get_stock_fundamentals(ticker) → dict
│   └── ddg_search.py             # search_web(query) → list[str]
├── checkpointing/
│   ├── __init__.py
│   └── setup.py                  # SqliteSaver factory + get_checkpoint_history()
├── ui/
│   ├── __init__.py
│   ├── cards.py                  # CONCEPT_CARDS dict keyed by node name
│   ├── trace_display.py          # sidebar trace renderer
│   └── hitl_panel.py             # approval form component
└── tests/
    ├── __init__.py
    ├── test_state.py
    ├── test_tools.py
    ├── test_supervisor.py
    ├── test_planner.py
    ├── test_research_agents.py   # fundamentals + news + risk
    ├── test_merger.py
    ├── test_synthesizer.py
    ├── test_finalizer.py
    ├── test_router.py
    └── test_graph_integration.py
```

---

## Task 1: Project Setup

**Files:**
- Create: `requirements.txt`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `pytest.ini`
- Create: `agents/__init__.py`, `graph/__init__.py`, `tools/__init__.py`, `ui/__init__.py`, `checkpointing/__init__.py`, `tests/__init__.py`

- [ ] **Step 1: Create requirements.txt**

```
langgraph>=0.2
anthropic>=0.49
yfinance>=0.2
duckduckgo-search>=6.0
streamlit>=1.40
python-dotenv>=1.0
pytest>=8.0
```

- [ ] **Step 2: Create .env.example and .gitignore**

`.env.example`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

`.gitignore`:
```
.env
__pycache__/
*.pyc
*.db
.superpowers/
research_checkpoints.db
```

- [ ] **Step 3: Create pytest.ini**

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_functions = test_*
```

- [ ] **Step 4: Create all empty __init__.py files**

```bash
mkdir -p agents graph tools checkpointing ui tests
touch agents/__init__.py graph/__init__.py tools/__init__.py \
      checkpointing/__init__.py ui/__init__.py tests/__init__.py
```

- [ ] **Step 5: Install dependencies**

```bash
pip install -r requirements.txt
```

Expected: installs without error. Verify with `python -c "import langgraph, anthropic, yfinance, streamlit"`.

- [ ] **Step 6: Copy .env.example to .env and add real key**

```bash
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY=sk-ant-<your key>
```

- [ ] **Step 7: Commit**

```bash
git add requirements.txt .env.example .gitignore pytest.ini agents/__init__.py \
        graph/__init__.py tools/__init__.py checkpointing/__init__.py ui/__init__.py \
        tests/__init__.py
git commit -m "chore: project setup — dependencies, pytest config, package structure"
```

---

## Task 2: State Schema

**Files:**
- Create: `state.py`
- Create: `tests/test_state.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_state.py`:
```python
import operator
from state import ResearchState, initial_state


def test_initial_state_has_all_fields():
    state = initial_state("What is AAPL?")
    assert state["query"] == "What is AAPL?"
    assert state["ticker"] == ""
    assert state["execution_trace"] == []
    assert state["iteration"] == 0
    assert state["approval_status"] == "pending"
    assert state["complexity"] == "simple"


def test_initial_state_research_fields_are_empty():
    state = initial_state("x")
    assert state["fundamentals"] == {}
    assert state["news_data"] == []
    assert state["risk_data"] == []
    assert state["merged_research"] == ""
    assert state["draft_brief"] == ""
    assert state["final_brief"] == ""


def test_execution_trace_reducer_concatenates():
    a = [{"node": "supervisor"}]
    b = [{"node": "planner"}]
    assert operator.add(a, b) == [{"node": "supervisor"}, {"node": "planner"}]


def test_execution_trace_parallel_append_is_safe():
    base = []
    f_entry = [{"node": "fundamentals"}]
    n_entry = [{"node": "news"}]
    merged = operator.add(operator.add(base, f_entry), n_entry)
    assert len(merged) == 2
    assert merged[0]["node"] == "fundamentals"
    assert merged[1]["node"] == "news"
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_state.py -v
```

Expected: `ModuleNotFoundError: No module named 'state'`

- [ ] **Step 3: Create state.py**

```python
from typing import Annotated, TypedDict
import operator


class ResearchState(TypedDict):
    # Input
    query: str
    ticker: str
    # Planning
    plan: list[str]
    complexity: str          # "simple" | "complex"
    # Research (one field per worker — no overlapping writes)
    fundamentals: dict
    news_data: list[str]
    risk_data: list[str]
    merged_research: str
    # Synthesis & review
    draft_brief: str
    human_feedback: str
    approval_status: str     # "pending"|"approved"|"rejected_stop"|"rejected_revise"
    iteration: int           # caps Reject+Revise loop at 3
    # Output
    final_brief: str
    # Audit — append-only via custom reducer
    execution_trace: Annotated[list[dict], operator.add]


def initial_state(query: str) -> ResearchState:
    return ResearchState(
        query=query,
        ticker="",
        plan=[],
        complexity="simple",
        fundamentals={},
        news_data=[],
        risk_data=[],
        merged_research="",
        draft_brief="",
        human_feedback="",
        approval_status="pending",
        iteration=0,
        final_brief="",
        execution_trace=[],
    )
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_state.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add state.py tests/test_state.py
git commit -m "feat: ResearchState TypedDict with operator.add reducer on execution_trace"
```

---

## Task 3: Tools

**Files:**
- Create: `tools/yfinance_tool.py`
- Create: `tools/ddg_search.py`
- Create: `tests/test_tools.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_tools.py`:
```python
from unittest.mock import patch, MagicMock


def test_get_stock_fundamentals_maps_yfinance_fields():
    mock_info = {
        "currentPrice": 189.30,
        "trailingPE": 28.4,
        "totalRevenue": 385_600_000_000,
        "grossMargins": 0.441,
        "marketCap": 2_900_000_000_000,
        "fiftyTwoWeekLow": 164.08,
        "fiftyTwoWeekHigh": 199.62,
    }
    mock_ticker = MagicMock()
    mock_ticker.info = mock_info
    with patch("tools.yfinance_tool.yf.Ticker", return_value=mock_ticker):
        from tools.yfinance_tool import get_stock_fundamentals
        result = get_stock_fundamentals("AAPL")
    assert result["price"] == 189.30
    assert result["pe_ratio"] == 28.4
    assert "164.08" in result["week_52_range"]


def test_get_stock_fundamentals_handles_missing_fields():
    mock_ticker = MagicMock()
    mock_ticker.info = {}
    with patch("tools.yfinance_tool.yf.Ticker", return_value=mock_ticker):
        from tools.yfinance_tool import get_stock_fundamentals
        result = get_stock_fundamentals("FAKE")
    assert result["price"] is None
    assert "N/A" in result["week_52_range"]


def test_search_web_returns_body_strings():
    mock_results = [
        {"body": "AAPL stock rises on earnings beat", "title": "T1"},
        {"body": "Apple reports record revenue", "title": "T2"},
        {"title": "No body entry"},
    ]
    mock_ddgs = MagicMock()
    mock_ddgs.text.return_value = mock_results
    with patch("tools.ddg_search.DDGS") as mock_cls:
        mock_cls.return_value.__enter__.return_value = mock_ddgs
        from tools.ddg_search import search_web
        result = search_web("AAPL stock news", max_results=5)
    assert len(result) == 2
    assert result[0] == "AAPL stock rises on earnings beat"


def test_search_web_passes_max_results():
    mock_ddgs = MagicMock()
    mock_ddgs.text.return_value = []
    with patch("tools.ddg_search.DDGS") as mock_cls:
        mock_cls.return_value.__enter__.return_value = mock_ddgs
        from tools.ddg_search import search_web
        search_web("query", max_results=3)
    mock_ddgs.text.assert_called_once_with("query", max_results=3)
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_tools.py -v
```

Expected: `ModuleNotFoundError: No module named 'tools.yfinance_tool'`

- [ ] **Step 3: Create tools/yfinance_tool.py**

```python
import yfinance as yf


def get_stock_fundamentals(ticker: str) -> dict:
    t = yf.Ticker(ticker)
    info = t.info
    low = info.get("fiftyTwoWeekLow", "N/A")
    high = info.get("fiftyTwoWeekHigh", "N/A")
    return {
        "price": info.get("currentPrice"),
        "pe_ratio": info.get("trailingPE"),
        "revenue_ttm": info.get("totalRevenue"),
        "gross_margin": info.get("grossMargins"),
        "market_cap": info.get("marketCap"),
        "week_52_range": f"{low} - {high}",
    }
```

- [ ] **Step 4: Create tools/ddg_search.py**

```python
from duckduckgo_search import DDGS


def search_web(query: str, max_results: int = 5) -> list[str]:
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=max_results))
    return [r["body"] for r in results if r.get("body")]
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
pytest tests/test_tools.py -v
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add tools/yfinance_tool.py tools/ddg_search.py tests/test_tools.py
git commit -m "feat: yfinance and DuckDuckGo tool wrappers"
```

---

## Task 4: Supervisor Agent

**Files:**
- Create: `agents/supervisor.py`
- Create: `tests/test_supervisor.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_supervisor.py`:
```python
from agents.supervisor import supervisor


def test_extracts_ticker_from_mixed_query():
    result = supervisor({"query": "Analyze AAPL fundamentals", "execution_trace": []})
    assert result["ticker"] == "AAPL"


def test_extracts_first_uppercase_word():
    result = supervisor({"query": "Compare MSFT and GOOGL performance", "execution_trace": []})
    assert result["ticker"] == "MSFT"


def test_falls_back_when_no_uppercase_word():
    result = supervisor({"query": "apple stock overview", "execution_trace": []})
    assert result["ticker"] == "APPLE"


def test_appends_trace_entry_with_ticker():
    result = supervisor({"query": "TSLA full analysis", "execution_trace": []})
    assert len(result["execution_trace"]) == 1
    entry = result["execution_trace"][0]
    assert entry["node"] == "supervisor"
    assert "TSLA" in entry["summary"]
    assert "timestamp" in entry
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_supervisor.py -v
```

Expected: `ModuleNotFoundError: No module named 'agents.supervisor'`

- [ ] **Step 3: Create agents/supervisor.py**

```python
import re
from datetime import datetime
from state import ResearchState


def supervisor(state: ResearchState) -> dict:
    query = state["query"]
    match = re.search(r'\b([A-Z]{1,5})\b', query)
    ticker = match.group(1) if match else query.upper()[:5].strip()
    return {
        "ticker": ticker,
        "execution_trace": [{
            "node": "supervisor",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Extracted ticker: {ticker}",
        }],
    }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_supervisor.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add agents/supervisor.py tests/test_supervisor.py
git commit -m "feat: supervisor agent — regex ticker extraction"
```

---

## Task 5: Planner Agent

**Files:**
- Create: `agents/planner.py`
- Create: `tests/test_planner.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_planner.py`:
```python
from unittest.mock import patch, MagicMock
from agents.planner import planner


def _mock_response(json_str: str) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=json_str)]
    return msg


def test_planner_tags_simple_query():
    resp = _mock_response('{"plan": ["Check price", "Review news"], "complexity": "simple"}')
    with patch("agents.planner.client") as mock_client:
        mock_client.messages.create.return_value = resp
        result = planner({"query": "AAPL price?", "ticker": "AAPL", "execution_trace": []})
    assert result["complexity"] == "simple"
    assert result["plan"] == ["Check price", "Review news"]


def test_planner_tags_complex_query():
    resp = _mock_response('{"plan": ["Fetch fundamentals", "Search news", "Assess risks", "Synthesize"], "complexity": "complex"}')
    with patch("agents.planner.client") as mock_client:
        mock_client.messages.create.return_value = resp
        result = planner({"query": "Full AAPL analysis", "ticker": "AAPL", "execution_trace": []})
    assert result["complexity"] == "complex"
    assert len(result["plan"]) == 4


def test_planner_appends_trace_with_complexity():
    resp = _mock_response('{"plan": ["step"], "complexity": "simple"}')
    with patch("agents.planner.client") as mock_client:
        mock_client.messages.create.return_value = resp
        result = planner({"query": "q", "ticker": "X", "execution_trace": []})
    entry = result["execution_trace"][0]
    assert entry["node"] == "planner"
    assert "complexity=simple" in entry["summary"]


def test_planner_calls_claude_with_cache_control():
    resp = _mock_response('{"plan": ["s"], "complexity": "simple"}')
    with patch("agents.planner.client") as mock_client:
        mock_client.messages.create.return_value = resp
        planner({"query": "q", "ticker": "X", "execution_trace": []})
    call_kwargs = mock_client.messages.create.call_args[1]
    system = call_kwargs["system"]
    assert system[0]["cache_control"] == {"type": "ephemeral"}
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_planner.py -v
```

Expected: `ModuleNotFoundError: No module named 'agents.planner'`

- [ ] **Step 3: Create agents/planner.py**

```python
import json
from datetime import datetime
import anthropic
from state import ResearchState

client = anthropic.Anthropic()

_SYSTEM = """You are an investment research planner. Output a JSON object only:
{
  "plan": ["step 1", "step 2", "step 3"],
  "complexity": "simple"
}
Rules:
- complexity "simple": price check, quick overview, single metric
- complexity "complex": full analysis, comparison, deep dive, multiple aspects
- plan: 3-5 short action strings
Output ONLY valid JSON, no other text."""


def planner(state: ResearchState) -> dict:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=[{"type": "text", "text": _SYSTEM, "cache_control": {"type": "ephemeral"}}],
        messages=[{
            "role": "user",
            "content": f"Query: {state['query']}\nTicker: {state['ticker']}",
        }],
    )
    data = json.loads(response.content[0].text)
    return {
        "plan": data["plan"],
        "complexity": data["complexity"],
        "execution_trace": [{
            "node": "planner",
            "timestamp": datetime.now().isoformat(),
            "summary": f"complexity={data['complexity']}, {len(data['plan'])} steps planned",
        }],
    }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_planner.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add agents/planner.py tests/test_planner.py
git commit -m "feat: planner agent — Claude Haiku structured output with prompt caching"
```

---

## Task 6: Research Agents (Fundamentals, News, Risk)

**Files:**
- Create: `agents/fundamentals.py`
- Create: `agents/news.py`
- Create: `agents/risk.py`
- Create: `tests/test_research_agents.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_research_agents.py`:
```python
from unittest.mock import patch


def test_fundamentals_writes_fundamentals_field():
    mock_data = {
        "price": 189.30, "pe_ratio": 28.4, "revenue_ttm": 385_000_000_000,
        "gross_margin": 0.441, "market_cap": 2_900_000_000_000, "week_52_range": "164 - 199",
    }
    with patch("agents.fundamentals.get_stock_fundamentals", return_value=mock_data):
        from agents.fundamentals import fundamentals
        result = fundamentals({"ticker": "AAPL", "execution_trace": []})
    assert result["fundamentals"]["price"] == 189.30
    assert result["execution_trace"][0]["node"] == "fundamentals"
    assert "AAPL" in result["execution_trace"][0]["summary"]


def test_news_writes_news_data_field():
    with patch("agents.news.search_web", return_value=["AAPL up 2%", "Apple beats earnings"]):
        from agents.news import news
        result = news({"ticker": "AAPL", "execution_trace": []})
    assert result["news_data"] == ["AAPL up 2%", "Apple beats earnings"]
    assert result["execution_trace"][0]["node"] == "news"
    assert "2" in result["execution_trace"][0]["summary"]


def test_risk_writes_risk_data_field():
    with patch("agents.risk.search_web", return_value=["China revenue risk", "Antitrust"]):
        from agents.risk import risk
        result = risk({"ticker": "AAPL", "execution_trace": []})
    assert result["risk_data"] == ["China revenue risk", "Antitrust"]
    assert result["execution_trace"][0]["node"] == "risk"


def test_news_searches_with_ticker_in_query():
    with patch("agents.news.search_web", return_value=[]) as mock_search:
        from agents.news import news
        news({"ticker": "TSLA", "execution_trace": []})
    call_query = mock_search.call_args[0][0]
    assert "TSLA" in call_query


def test_risk_searches_with_risk_keywords():
    with patch("agents.risk.search_web", return_value=[]) as mock_search:
        from agents.risk import risk
        risk({"ticker": "MSFT", "execution_trace": []})
    call_query = mock_search.call_args[0][0]
    assert "MSFT" in call_query
    assert "risk" in call_query.lower()
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_research_agents.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Create agents/fundamentals.py**

```python
from datetime import datetime
from state import ResearchState
from tools.yfinance_tool import get_stock_fundamentals


def fundamentals(state: ResearchState) -> dict:
    data = get_stock_fundamentals(state["ticker"])
    return {
        "fundamentals": data,
        "execution_trace": [{
            "node": "fundamentals",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Fetched yfinance data for {state['ticker']}: price={data.get('price')}",
        }],
    }
```

- [ ] **Step 4: Create agents/news.py**

```python
from datetime import datetime
from state import ResearchState
from tools.ddg_search import search_web


def news(state: ResearchState) -> dict:
    snippets = search_web(f"{state['ticker']} stock news latest", max_results=5)
    return {
        "news_data": snippets,
        "execution_trace": [{
            "node": "news",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Found {len(snippets)} news items for {state['ticker']}",
        }],
    }
```

- [ ] **Step 5: Create agents/risk.py**

```python
from datetime import datetime
from state import ResearchState
from tools.ddg_search import search_web


def risk(state: ResearchState) -> dict:
    snippets = search_web(f"{state['ticker']} risks competitors regulatory outlook", max_results=5)
    return {
        "risk_data": snippets,
        "execution_trace": [{
            "node": "risk",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Found {len(snippets)} risk items for {state['ticker']}",
        }],
    }
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
pytest tests/test_research_agents.py -v
```

Expected: 5 passed.

- [ ] **Step 7: Commit**

```bash
git add agents/fundamentals.py agents/news.py agents/risk.py tests/test_research_agents.py
git commit -m "feat: fundamentals, news, risk agents — yfinance and DuckDuckGo"
```

---

## Task 7: Merger Agent

**Files:**
- Create: `agents/merger.py`
- Create: `tests/test_merger.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_merger.py`:
```python
from agents.merger import merger


def _state(**overrides):
    base = {
        "ticker": "AAPL",
        "fundamentals": {},
        "news_data": [],
        "risk_data": [],
        "execution_trace": [],
    }
    return {**base, **overrides}


def test_simple_path_shows_fundamentals_only():
    result = merger(_state(fundamentals={"price": 189.30, "pe_ratio": 28.4}))
    assert "Fundamentals" in result["merged_research"]
    assert "Recent News" not in result["merged_research"]
    assert "Risk Factors" not in result["merged_research"]


def test_complex_path_shows_all_three_sections():
    result = merger(_state(
        fundamentals={"price": 189.30},
        news_data=["AAPL up 2%"],
        risk_data=["China risk"],
    ))
    assert "Fundamentals" in result["merged_research"]
    assert "Recent News" in result["merged_research"]
    assert "Risk Factors" in result["merged_research"]


def test_handles_none_news_and_risk():
    result = merger(_state(fundamentals={"price": 100}, news_data=None, risk_data=None))
    assert result["merged_research"]  # no KeyError or crash
    assert "Recent News" not in result["merged_research"]


def test_trace_counts_sections():
    result = merger(_state(
        fundamentals={"price": 100},
        news_data=["n1"],
        risk_data=["r1"],
    ))
    assert result["execution_trace"][0]["node"] == "merger"
    assert "3" in result["execution_trace"][0]["summary"]


def test_fundamentals_none_values_skipped():
    result = merger(_state(fundamentals={"price": 189, "pe_ratio": None}))
    assert "pe_ratio" not in result["merged_research"]
    assert "189" in result["merged_research"]
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_merger.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Create agents/merger.py**

```python
from datetime import datetime
from state import ResearchState


def merger(state: ResearchState) -> dict:
    sections = []

    f = state.get("fundamentals") or {}
    if f:
        lines = [f"**Fundamentals — {state.get('ticker', '')}**"]
        lines += [f"  {k}: {v}" for k, v in f.items() if v is not None]
        sections.append("\n".join(lines))

    for items, header in [
        (state.get("news_data") or [], "**Recent News**"),
        (state.get("risk_data") or [], "**Risk Factors**"),
    ]:
        if items:
            sections.append("\n".join([header] + [f"  - {item}" for item in items]))

    return {
        "merged_research": "\n\n".join(sections),
        "execution_trace": [{
            "node": "merger",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Merged {len(sections)} research sections",
        }],
    }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_merger.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add agents/merger.py tests/test_merger.py
git commit -m "feat: merger agent — fan-in combines research fields, handles simple/complex paths"
```

---

## Task 8: Synthesizer Agent

**Files:**
- Create: `agents/synthesizer.py`
- Create: `tests/test_synthesizer.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_synthesizer.py`:
```python
from unittest.mock import patch, MagicMock
from agents.synthesizer import synthesizer


def _mock_resp(text: str) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


def _state(**overrides):
    base = {
        "ticker": "AAPL",
        "merged_research": "price: 189",
        "human_feedback": "",
        "iteration": 0,
        "execution_trace": [],
    }
    return {**base, **overrides}


def test_synthesizer_writes_draft_brief():
    with patch("agents.synthesizer.client") as mc:
        mc.messages.create.return_value = _mock_resp("## AAPL Brief\n\nStrong fundamentals.")
        result = synthesizer(_state())
    assert "AAPL Brief" in result["draft_brief"]
    assert result["approval_status"] == "pending"


def test_synthesizer_increments_iteration():
    with patch("agents.synthesizer.client") as mc:
        mc.messages.create.return_value = _mock_resp("brief")
        result = synthesizer(_state(iteration=2))
    assert result["iteration"] == 3


def test_synthesizer_includes_feedback_on_revise():
    with patch("agents.synthesizer.client") as mc:
        mc.messages.create.return_value = _mock_resp("revised brief")
        synthesizer(_state(human_feedback="Add more China risk detail", iteration=1))
        user_content = mc.messages.create.call_args[1]["messages"][0]["content"]
    assert "Add more China risk detail" in user_content


def test_synthesizer_uses_prompt_caching():
    with patch("agents.synthesizer.client") as mc:
        mc.messages.create.return_value = _mock_resp("brief")
        synthesizer(_state())
        system = mc.messages.create.call_args[1]["system"]
    assert system[0]["cache_control"] == {"type": "ephemeral"}


def test_synthesizer_appends_trace():
    with patch("agents.synthesizer.client") as mc:
        mc.messages.create.return_value = _mock_resp("brief")
        result = synthesizer(_state(iteration=1))
    assert result["execution_trace"][0]["node"] == "synthesizer"
    assert "iteration 2" in result["execution_trace"][0]["summary"]
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_synthesizer.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Create agents/synthesizer.py**

```python
from datetime import datetime
import anthropic
from state import ResearchState

client = anthropic.Anthropic()

_SYSTEM = """You are an investment research analyst. Write a concise investment brief in markdown.

Structure (use these exact headers):
## [TICKER] Investment Brief

**Fundamentals Summary** — 2-3 sentences on key metrics

**News Sentiment** — 1-2 sentences

**Key Risks**
- risk 1
- risk 2

**Outlook** — Buy / Hold / Sell with one-sentence rationale

Be factual. Never invent data not present in the research."""


def synthesizer(state: ResearchState) -> dict:
    feedback = state.get("human_feedback", "")
    feedback_section = f"\n\nRevision requested by human reviewer:\n{feedback}" if feedback else ""
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=[{"type": "text", "text": _SYSTEM, "cache_control": {"type": "ephemeral"}}],
        messages=[{
            "role": "user",
            "content": (
                f"Research for {state['ticker']}:\n\n{state['merged_research']}"
                f"{feedback_section}"
            ),
        }],
    )
    new_iteration = state.get("iteration", 0) + 1
    return {
        "draft_brief": response.content[0].text,
        "iteration": new_iteration,
        "approval_status": "pending",
        "execution_trace": [{
            "node": "synthesizer",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Draft brief generated (iteration {new_iteration})",
        }],
    }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_synthesizer.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add agents/synthesizer.py tests/test_synthesizer.py
git commit -m "feat: synthesizer agent — Claude Sonnet with prompt caching, handles revision feedback"
```

---

## Task 9: review_gate and Finalizer

**Files:**
- Create: `agents/review_gate.py`
- Create: `agents/finalizer.py`
- Create: `tests/test_finalizer.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_finalizer.py`:
```python
from agents.review_gate import review_gate
from agents.finalizer import finalizer


def test_review_gate_returns_only_trace():
    result = review_gate({"approval_status": "approved", "execution_trace": []})
    assert set(result.keys()) == {"execution_trace"}
    assert result["execution_trace"][0]["node"] == "review_gate"
    assert "approved" in result["execution_trace"][0]["summary"]


def test_review_gate_records_rejection():
    result = review_gate({"approval_status": "rejected_stop", "execution_trace": []})
    assert "rejected_stop" in result["execution_trace"][0]["summary"]


def test_finalizer_wraps_draft_brief_with_approved_header():
    result = finalizer({
        "ticker": "AAPL",
        "draft_brief": "## AAPL Brief\n\nStrong fundamentals.",
        "execution_trace": [],
    })
    assert "APPROVED" in result["final_brief"]
    assert "AAPL" in result["final_brief"]
    assert "Reviewed and approved" in result["final_brief"]
    assert "## AAPL Brief" in result["final_brief"]


def test_finalizer_appends_trace():
    result = finalizer({"ticker": "TSLA", "draft_brief": "brief", "execution_trace": []})
    assert result["execution_trace"][0]["node"] == "finalizer"
    assert "TSLA" in result["execution_trace"][0]["summary"]
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_finalizer.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Create agents/review_gate.py**

```python
from datetime import datetime
from state import ResearchState


def review_gate(state: ResearchState) -> dict:
    # Trivial interrupt target. Human has already updated state before this runs.
    # The 3-way routing lives on the conditional edge that follows, not here.
    return {
        "execution_trace": [{
            "node": "review_gate",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Human decision: {state.get('approval_status', 'pending')}",
        }]
    }
```

- [ ] **Step 4: Create agents/finalizer.py**

```python
from datetime import datetime
from state import ResearchState


def finalizer(state: ResearchState) -> dict:
    ticker = state.get("ticker", "Unknown")
    brief = state.get("draft_brief", "")
    final = (
        f"# APPROVED — {ticker} Investment Brief\n\n"
        f"{brief}\n\n"
        f"---\n*Reviewed and approved by human analyst.*"
    )
    return {
        "final_brief": final,
        "execution_trace": [{
            "node": "finalizer",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Brief finalized for {ticker}",
        }],
    }
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
pytest tests/test_finalizer.py -v
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add agents/review_gate.py agents/finalizer.py tests/test_finalizer.py
git commit -m "feat: review_gate (interrupt target) and finalizer agents"
```

---

## Task 10: Router Functions

**Files:**
- Create: `graph/router.py`
- Create: `tests/test_router.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_router.py`:
```python
from langgraph.graph import END
from langgraph.types import Send
from graph.router import route_after_planner, route_after_review


def _state(**overrides):
    return {"complexity": "simple", "approval_status": "pending", "iteration": 0, **overrides}


def test_simple_path_returns_string():
    assert route_after_planner(_state(complexity="simple")) == "fundamentals"


def test_complex_path_returns_three_sends():
    result = route_after_planner(_state(complexity="complex"))
    assert isinstance(result, list)
    assert len(result) == 3
    assert all(isinstance(s, Send) for s in result)
    assert {s.node for s in result} == {"fundamentals", "news", "risk"}


def test_approved_routes_to_finalizer():
    assert route_after_review(_state(approval_status="approved")) == "finalizer"


def test_rejected_stop_routes_to_end():
    assert route_after_review(_state(approval_status="rejected_stop")) == END


def test_rejected_revise_routes_to_synthesizer():
    result = route_after_review(_state(approval_status="rejected_revise", iteration=1))
    assert result == "synthesizer"


def test_rejected_revise_at_iteration_3_forces_finalizer():
    result = route_after_review(_state(approval_status="rejected_revise", iteration=3))
    assert result == "finalizer"


def test_unknown_status_defaults_to_synthesizer():
    result = route_after_review(_state(approval_status="unknown", iteration=0))
    assert result == "synthesizer"
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_router.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Create graph/router.py**

```python
from langgraph.graph import END
from langgraph.types import Send
from state import ResearchState


def route_after_planner(state: ResearchState):
    if state["complexity"] == "simple":
        return "fundamentals"
    return [
        Send("fundamentals", state),
        Send("news", state),
        Send("risk", state),
    ]


def route_after_review(state: ResearchState):
    status = state.get("approval_status", "pending")
    if status == "approved":
        return "finalizer"
    if status == "rejected_stop":
        return END
    if state.get("iteration", 0) >= 3:
        return "finalizer"
    return "synthesizer"
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_router.py -v
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add graph/router.py tests/test_router.py
git commit -m "feat: router functions — conditional_edges for simple/complex and HITL outcomes"
```

---

## Task 11: Graph Builder + Integration Tests

**Files:**
- Create: `graph/builder.py`
- Create: `tests/test_graph_integration.py`

- [ ] **Step 1: Write the failing integration tests**

`tests/test_graph_integration.py`:
```python
import uuid
from unittest.mock import patch, MagicMock
from langgraph.checkpoint.memory import MemorySaver
from graph.builder import build_graph
from state import initial_state


def _mock_claude(text: str) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


def _mock_yf():
    return {
        "price": 189.0, "pe_ratio": 28.0, "revenue_ttm": None,
        "gross_margin": None, "market_cap": None, "week_52_range": "N/A",
    }


def _config():
    return {"configurable": {"thread_id": str(uuid.uuid4())}}


def test_graph_compiles_without_error():
    assert build_graph() is not None


def test_simple_path_interrupts_at_review_gate():
    with patch("agents.planner.client") as mp, \
         patch("agents.fundamentals.get_stock_fundamentals", return_value=_mock_yf()), \
         patch("agents.synthesizer.client") as ms:

        mp.messages.create.return_value = _mock_claude(
            '{"plan": ["Check price"], "complexity": "simple"}'
        )
        ms.messages.create.return_value = _mock_claude("## AAPL Brief\n\nStrong.")

        g = build_graph(MemorySaver())
        config = _config()
        g.invoke(initial_state("AAPL price check"), config)

        state = g.get_state(config)
        assert "review_gate" in state.next


def test_approve_produces_final_brief():
    with patch("agents.planner.client") as mp, \
         patch("agents.fundamentals.get_stock_fundamentals", return_value=_mock_yf()), \
         patch("agents.synthesizer.client") as ms:

        mp.messages.create.return_value = _mock_claude(
            '{"plan": ["Check price"], "complexity": "simple"}'
        )
        ms.messages.create.return_value = _mock_claude("## AAPL Brief")

        g = build_graph(MemorySaver())
        config = _config()
        g.invoke(initial_state("AAPL"), config)
        g.update_state(config, {"approval_status": "approved"})
        final = g.invoke(None, config)

        assert final["final_brief"]
        assert "APPROVED" in final["final_brief"]


def test_reject_stop_ends_without_final_brief():
    with patch("agents.planner.client") as mp, \
         patch("agents.fundamentals.get_stock_fundamentals", return_value=_mock_yf()), \
         patch("agents.synthesizer.client") as ms:

        mp.messages.create.return_value = _mock_claude(
            '{"plan": ["Check"], "complexity": "simple"}'
        )
        ms.messages.create.return_value = _mock_claude("brief")

        g = build_graph(MemorySaver())
        config = _config()
        g.invoke(initial_state("AAPL"), config)
        g.update_state(config, {"approval_status": "rejected_stop"})
        final = g.invoke(None, config)

        assert not final.get("final_brief")


def test_reject_revise_loops_back_to_synthesizer():
    with patch("agents.planner.client") as mp, \
         patch("agents.fundamentals.get_stock_fundamentals", return_value=_mock_yf()), \
         patch("agents.synthesizer.client") as ms:

        mp.messages.create.return_value = _mock_claude(
            '{"plan": ["Check"], "complexity": "simple"}'
        )
        ms.messages.create.return_value = _mock_claude("brief")

        g = build_graph(MemorySaver())
        config = _config()
        g.invoke(initial_state("AAPL"), config)
        g.update_state(config, {
            "approval_status": "rejected_revise",
            "human_feedback": "Add more China risk detail",
        })
        g.invoke(None, config)

        state = g.get_state(config)
        assert "review_gate" in state.next
        assert state.values["iteration"] == 2
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_graph_integration.py -v
```

Expected: `ModuleNotFoundError: No module named 'graph.builder'`

- [ ] **Step 3: Create graph/builder.py**

```python
from langgraph.graph import StateGraph, START, END
from state import ResearchState
from agents.supervisor import supervisor
from agents.planner import planner
from agents.fundamentals import fundamentals
from agents.news import news
from agents.risk import risk
from agents.merger import merger
from agents.synthesizer import synthesizer
from agents.review_gate import review_gate
from agents.finalizer import finalizer
from graph.router import route_after_planner, route_after_review


def build_graph(checkpointer=None):
    g = StateGraph(ResearchState)

    g.add_node("supervisor", supervisor)
    g.add_node("planner", planner)
    g.add_node("fundamentals", fundamentals)
    g.add_node("news", news)
    g.add_node("risk", risk)
    g.add_node("merger", merger)
    g.add_node("synthesizer", synthesizer)
    g.add_node("review_gate", review_gate)
    g.add_node("finalizer", finalizer)

    g.add_edge(START, "supervisor")
    g.add_edge("supervisor", "planner")
    g.add_conditional_edges("planner", route_after_planner)
    g.add_edge("fundamentals", "merger")
    g.add_edge("news", "merger")
    g.add_edge("risk", "merger")
    g.add_edge("merger", "synthesizer")
    g.add_edge("synthesizer", "review_gate")
    g.add_conditional_edges(
        "review_gate",
        route_after_review,
        {"finalizer": "finalizer", "synthesizer": "synthesizer", END: END},
    )
    g.add_edge("finalizer", END)

    return g.compile(
        checkpointer=checkpointer,
        interrupt_before=["review_gate"],
    )
```

- [ ] **Step 4: Run all tests**

```bash
pytest -v
```

Expected: all tests pass (27+ tests).

- [ ] **Step 5: Commit**

```bash
git add graph/builder.py tests/test_graph_integration.py
git commit -m "feat: graph builder — StateGraph with SqliteSaver, interrupt_before review_gate"
```

---

## Task 12: Checkpointing Setup

**Files:**
- Create: `checkpointing/setup.py`

- [ ] **Step 1: Create checkpointing/setup.py**

```python
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
```

- [ ] **Step 2: Verify checkpointer integrates with graph**

```bash
python -c "
from checkpointing.setup import make_checkpointer, make_config
from graph.builder import build_graph
from state import initial_state
c = make_checkpointer()
g = build_graph(c)
print('Graph compiled with SqliteSaver:', g)
"
```

Expected: prints `Graph compiled with SqliteSaver: CompiledStateGraph(...)` without error. `research_checkpoints.db` is created.

- [ ] **Step 3: Commit**

```bash
git add checkpointing/setup.py
git commit -m "feat: SqliteSaver checkpointing setup with thread config and history helper"
```

---

## Task 13: UI Components

**Files:**
- Create: `ui/cards.py`
- Create: `ui/trace_display.py`
- Create: `ui/hitl_panel.py`

- [ ] **Step 1: Create ui/cards.py**

```python
from dataclasses import dataclass


@dataclass
class ConceptCard:
    title: str
    description: str
    code_snippet: str
    problem_solved: str


CONCEPT_CARDS: dict[str, ConceptCard] = {
    "supervisor": ConceptCard(
        title="StateGraph + TypedDict",
        description="A single ResearchState TypedDict is shared across all agents. Every node reads from it and returns a partial dict update. LangGraph merges updates using field-level reducers.",
        code_snippet="class ResearchState(TypedDict):\n    ticker: str\n    execution_trace: Annotated[list[dict], operator.add]",
        problem_solved="Problem 5 — Multiple specialist agents cannot collaborate",
    ),
    "planner": ConceptCard(
        title="Typed State Write + Custom Reducer",
        description="The Planner writes plan and complexity to shared state. execution_trace uses operator.add — every node appends its entry without overwriting entries from other nodes.",
        code_snippet='return {\n    "plan": [...],\n    "complexity": "simple",\n    "execution_trace": [{"node": "planner", ...}],\n}',
        problem_solved="Problem 1 — Loses intermediate context during multi-step reasoning",
    ),
    "router": ConceptCard(
        title="conditional_edges + Send() Fan-Out",
        description="The Router reads state.complexity. For 'simple' it returns a string. For 'complex' it returns a list of Send() objects — LangGraph executes all three agents in parallel.",
        code_snippet='def route_after_planner(state):\n    if state["complexity"] == "simple":\n        return "fundamentals"\n    return [Send("fundamentals", state),\n            Send("news", state),\n            Send("risk", state)]',
        problem_solved="Problem 3 — No conditional decisions or parallel research paths",
    ),
    "fundamentals": ConceptCard(
        title="Parallel Fan-Out (complex path)",
        description="On complex queries, Fundamentals, News, and Risk run simultaneously via Send(). Each writes to its own non-overlapping field. operator.add on execution_trace merges their trace entries safely.",
        code_snippet="g.add_edge('fundamentals', 'merger')\ng.add_edge('news', 'merger')\ng.add_edge('risk', 'merger')\n# All three fan-in at merger",
        problem_solved="Problem 3 — No parallel research paths",
    ),
    "news": ConceptCard(
        title="Parallel Fan-Out (complex path)",
        description="On complex queries, Fundamentals, News, and Risk run simultaneously via Send(). Each writes to its own non-overlapping field. operator.add on execution_trace merges their trace entries safely.",
        code_snippet="g.add_edge('fundamentals', 'merger')\ng.add_edge('news', 'merger')\ng.add_edge('risk', 'merger')\n# All three fan-in at merger",
        problem_solved="Problem 3 — No parallel research paths",
    ),
    "risk": ConceptCard(
        title="Parallel Fan-Out (complex path)",
        description="On complex queries, Fundamentals, News, and Risk run simultaneously via Send(). Each writes to its own non-overlapping field. operator.add on execution_trace merges their trace entries safely.",
        code_snippet="g.add_edge('fundamentals', 'merger')\ng.add_edge('news', 'merger')\ng.add_edge('risk', 'merger')\n# All three fan-in at merger",
        problem_solved="Problem 3 — No parallel research paths",
    ),
    "merger": ConceptCard(
        title="Fan-In + operator.add Reducer",
        description="Merger runs after all parallel agents complete. It combines populated research fields. Because execution_trace uses operator.add, all three agents' trace entries are accumulated without conflict.",
        code_snippet="execution_trace: Annotated[list[dict], operator.add]\n# Parallel agents each append; LangGraph concatenates all lists.",
        problem_solved="Problem 3 — Branch merge",
    ),
    "synthesizer": ConceptCard(
        title="SqliteSaver Checkpointing",
        description="Before synthesis, every prior state is persisted to SQLite. If Synthesizer fails, call invoke() again with the same thread_id — LangGraph resumes from the last good checkpoint.",
        code_snippet="from langgraph.checkpoint.sqlite import SqliteSaver\ng.compile(checkpointer=SqliteSaver(conn))\n# Resuming:\ngraph.invoke(None, config)  # replays from checkpoint",
        problem_solved="Problem 2 — Failures require restarting the entire workflow",
    ),
    "review_gate": ConceptCard(
        title="interrupt_before + update_state",
        description="The graph pauses before review_gate. Streamlit shows the draft brief and approval buttons. update_state() injects the human's decision into state. invoke(None, config) resumes from the interrupt.",
        code_snippet="g.compile(interrupt_before=['review_gate'])\n# Human decides:\ngraph.update_state(config, {'approval_status': 'approved'})\ngraph.invoke(None, config)  # resumes",
        problem_solved="Problem 4 — Critical responses generated without human review",
    ),
    "finalizer": ConceptCard(
        title="get_state_history — Time-Travel Debug",
        description="get_state_history() returns every persisted checkpoint in reverse order. Each can be replayed by passing its config to invoke(). Shows the full execution path including any revision loops.",
        code_snippet="for state in graph.get_state_history(config):\n    print(state.metadata['step'], list(state.next))",
        problem_solved="Capstone Req: Debugging & Explainability",
    ),
}
```

- [ ] **Step 2: Create ui/trace_display.py**

```python
import streamlit as st


def render_trace(execution_trace: list[dict]) -> None:
    if not execution_trace:
        st.sidebar.caption("No steps completed yet.")
        return
    for entry in execution_trace:
        node = entry.get("node", "?")
        summary = entry.get("summary", "")
        st.sidebar.markdown(f"✓ **{node}** — {summary}")
```

- [ ] **Step 3: Create ui/hitl_panel.py**

```python
import streamlit as st


def render_hitl_panel(draft_brief: str, iteration: int) -> tuple[str | None, str]:
    """
    Returns (approval_status, human_feedback) when a button is clicked.
    Returns (None, "") if no button has been clicked yet.
    """
    col1, col2 = st.columns([2, 1])

    with col1:
        st.markdown("**Draft Investment Brief**")
        st.markdown(draft_brief)

    with col2:
        st.markdown("**Review Decision**")
        feedback = st.text_area(
            "Feedback (required for Revise)",
            key=f"feedback_{iteration}",
            height=100,
            placeholder="Describe what to improve…",
        )
        st.caption(f"Iteration {iteration} / 3")

        if st.button("✓ Approve Brief", key=f"approve_{iteration}", use_container_width=True):
            return "approved", ""
        if st.button("✗ Reject — Stop", key=f"stop_{iteration}", use_container_width=True):
            return "rejected_stop", ""
        if st.button("↺ Reject — Revise", key=f"revise_{iteration}", use_container_width=True):
            return "rejected_revise", feedback

    return None, ""
```

- [ ] **Step 4: Verify cards import cleanly**

```bash
python -c "from ui.cards import CONCEPT_CARDS; print(list(CONCEPT_CARDS.keys()))"
```

Expected: `['supervisor', 'planner', 'router', 'fundamentals', 'news', 'risk', 'merger', 'synthesizer', 'review_gate', 'finalizer']`

- [ ] **Step 5: Commit**

```bash
git add ui/cards.py ui/trace_display.py ui/hitl_panel.py
git commit -m "feat: UI components — concept cards, trace display, HITL approval panel"
```

---

## Task 14: Main Streamlit App

**Files:**
- Create: `main.py`

- [ ] **Step 1: Create main.py**

```python
import uuid
import streamlit as st
from dotenv import load_dotenv
from graph.builder import build_graph
from checkpointing.setup import make_checkpointer, make_config, get_checkpoint_history
from state import initial_state
from ui.cards import CONCEPT_CARDS
from ui.trace_display import render_trace
from ui.hitl_panel import render_hitl_panel

load_dotenv()

st.set_page_config(page_title="LangGraph Investment Research Demo", layout="wide")
st.title("Investment Research Brief — LangGraph Multi-Agent Demo")

# ── Session state ────────────────────────────────────────────────────────────
if "graph" not in st.session_state:
    st.session_state.graph = build_graph(make_checkpointer())
if "thread_id" not in st.session_state:
    st.session_state.thread_id = str(uuid.uuid4())
if "app_state" not in st.session_state:
    st.session_state.app_state = "idle"   # idle | hitl | complete | error
if "events" not in st.session_state:
    st.session_state.events = []

graph = st.session_state.graph

# ── Sidebar ──────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("Research Query")
    query = st.text_input(
        "Enter query",
        placeholder="e.g. Full AAPL analysis  or  MSFT price check",
        key="query_input",
    )
    run_clicked = st.button(
        "▶ Run Research",
        disabled=st.session_state.app_state not in ("idle",),
    )

    if st.button("🔄 New Session"):
        st.session_state.thread_id = str(uuid.uuid4())
        st.session_state.app_state = "idle"
        st.session_state.events = []
        st.rerun()

    st.divider()
    st.caption(f"Thread: `{st.session_state.thread_id[:8]}…`")
    st.caption(f"State: `{st.session_state.app_state}`")

    if st.session_state.app_state != "idle":
        config = make_config(st.session_state.thread_id)
        try:
            gs = graph.get_state(config)
            render_trace(gs.values.get("execution_trace", []))
        except Exception:
            pass

# ── Run the graph ────────────────────────────────────────────────────────────
if run_clicked and query:
    st.session_state.thread_id = str(uuid.uuid4())
    st.session_state.events = []
    config = make_config(st.session_state.thread_id)

    with st.spinner("Running research agents…"):
        try:
            events = []
            for event in graph.stream(initial_state(query), config, stream_mode="updates"):
                events.append(event)
            st.session_state.events = events
        except Exception as e:
            st.session_state.app_state = "error"
            st.session_state.error_msg = str(e)
            st.rerun()

    gs = graph.get_state(config)
    if "review_gate" in (gs.next or []):
        st.session_state.app_state = "hitl"
    else:
        st.session_state.app_state = "complete"
    st.rerun()

# ── Render by app_state ───────────────────────────────────────────────────────
config = make_config(st.session_state.thread_id)

if st.session_state.app_state == "idle":
    st.info("Enter a query in the sidebar and click **▶ Run Research** to start.")
    st.markdown("""
**Example queries:**
- `Full AAPL analysis` → complex path (3 parallel agents + full brief)
- `MSFT price check` → simple path (fundamentals only)
- `TSLA risks and competitors` → complex path
    """)

elif st.session_state.app_state == "hitl":
    gs = graph.get_state(config)
    values = gs.values

    # Show HITL concept card
    card = CONCEPT_CARDS["review_gate"]
    with st.expander(f"⚡ LangGraph: {card.title} — {card.problem_solved}", expanded=True):
        st.markdown(card.description)
        st.code(card.code_snippet, language="python")

    st.divider()
    st.subheader("⏸ Graph Paused — Human Review Required")

    approval_status, feedback = render_hitl_panel(
        values.get("draft_brief", ""),
        values.get("iteration", 1),
    )

    if approval_status:
        graph.update_state(config, {"approval_status": approval_status, "human_feedback": feedback})
        with st.spinner("Resuming graph…"):
            try:
                for event in graph.stream(None, config, stream_mode="updates"):
                    st.session_state.events.append(event)
            except Exception as e:
                st.session_state.error_msg = str(e)
                st.session_state.app_state = "error"
                st.rerun()

        resumed = graph.get_state(config)
        if "review_gate" in (resumed.next or []):
            st.session_state.app_state = "hitl"
        else:
            st.session_state.app_state = "complete"
        st.rerun()

elif st.session_state.app_state == "complete":
    gs = graph.get_state(config)
    values = gs.values
    final = values.get("final_brief", "")

    if final:
        st.success("✓ Research complete — brief approved.")
        st.markdown(final)
        st.download_button(
            "⬇ Download Brief (Markdown)",
            data=final,
            file_name=f"{values.get('ticker', 'brief')}_investment_brief.md",
            mime="text/markdown",
        )
    else:
        st.warning("Research ended — brief was rejected without revision.")

    # Show concept cards for each node that ran (in execution_trace order)
    trace = values.get("execution_trace", [])
    seen_nodes = []
    for entry in trace:
        n = entry.get("node")
        if n and n not in seen_nodes:
            seen_nodes.append(n)

    with st.expander("⚡ Concepts Demonstrated in This Run", expanded=False):
        for node_name in seen_nodes:
            card = CONCEPT_CARDS.get(node_name)
            if card:
                st.markdown(f"**{card.title}** — *{card.problem_solved}*")
                st.markdown(card.description)
                st.code(card.code_snippet, language="python")
                st.divider()

    with st.expander("🔍 Time-Travel Debug — Execution Timeline", expanded=False):
        card = CONCEPT_CARDS["finalizer"]
        st.markdown(f"**{card.title}:** {card.description}")
        st.code(card.code_snippet, language="python")
        st.divider()
        history = get_checkpoint_history(graph, config)
        for h in history:
            next_str = ", ".join(h["next"]) if h["next"] else "END"
            st.text(f"Step {h['step']:>3} | {h['node']:<20} → {next_str}")

    if st.button("▶ Run Another Query"):
        st.session_state.thread_id = str(uuid.uuid4())
        st.session_state.app_state = "idle"
        st.session_state.events = []
        st.rerun()

elif st.session_state.app_state == "error":
    st.error(f"Execution error: {st.session_state.get('error_msg', 'Unknown')}")
    st.info("The last successful checkpoint is preserved. Click below to resume from it.")

    card = CONCEPT_CARDS["synthesizer"]
    with st.expander(f"⚡ LangGraph: {card.title} — {card.problem_solved}"):
        st.markdown(card.description)
        st.code(card.code_snippet, language="python")

    if st.button("↺ Resume from Checkpoint"):
        with st.spinner("Resuming…"):
            try:
                for event in graph.stream(None, config, stream_mode="updates"):
                    st.session_state.events.append(event)
                resumed = graph.get_state(config)
                if "review_gate" in (resumed.next or []):
                    st.session_state.app_state = "hitl"
                else:
                    st.session_state.app_state = "complete"
            except Exception as e:
                st.session_state.error_msg = str(e)
        st.rerun()
```

- [ ] **Step 2: Run the Streamlit app and verify it launches**

```bash
streamlit run main.py
```

Expected: browser opens at `http://localhost:8501` with the input form visible, no errors in terminal.

- [ ] **Step 3: Test simple path end-to-end**

In the browser:
1. Enter query: `AAPL price check`
2. Click **▶ Run Research**
3. Verify spinner runs, then HITL panel appears with a draft brief
4. Click **✓ Approve Brief**
5. Verify final brief shows with download button
6. Expand **Time-Travel Debug** and verify checkpoint list appears

- [ ] **Step 4: Test complex path end-to-end**

1. Click **🔄 New Session**
2. Enter query: `Full MSFT analysis`
3. Click **▶ Run Research**
4. Verify draft brief appears (3 research agents ran — check sidebar trace shows fundamentals, news, risk)
5. Click **↺ Reject — Revise**, enter feedback `Add more detail on cloud revenue growth`, click **↺ Reject — Revise**
6. Verify graph loops back, synthesizer runs again, new HITL panel appears with iteration 2
7. Click **✓ Approve Brief**, verify final brief

- [ ] **Step 5: Commit**

```bash
git add main.py
git commit -m "feat: Streamlit app — full HITL flow, concept cards, time-travel debug"
```

---

## Task 15: CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create CLAUDE.md**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A LangGraph multi-agent investment research assistant built as a training demonstration. Shows typed state, conditional routing, parallel fan-out, SQLite checkpointing, and human-in-the-loop patterns via a Streamlit UI.

## Commands

```bash
# Run the Streamlit demo
streamlit run main.py

# Run all tests
pytest -v

# Run a single test file
pytest tests/test_router.py -v

# Run a single test
pytest tests/test_router.py::test_complex_path_returns_three_sends -v
```

## Architecture

9-node `StateGraph`: `supervisor → planner → [router] → fundamentals/(news+risk parallel) → merger → synthesizer → review_gate → finalizer`

- `interrupt_before=["review_gate"]` — graph pauses here for human approval
- `SqliteSaver` — every node completion is checkpointed to `research_checkpoints.db`
- Simple path: only `fundamentals` runs. Complex path: `fundamentals + news + risk` run in parallel via `Send()`
- `execution_trace` is the only `Annotated` reducer field — uses `operator.add` for safe parallel appends

## Key Files

| File | Purpose |
|------|---------|
| `state.py` | `ResearchState` TypedDict + `initial_state()` factory |
| `graph/builder.py` | Single function `build_graph(checkpointer=None)` — all wiring here |
| `graph/router.py` | `route_after_planner` and `route_after_review` — pure functions, easy to test |
| `agents/review_gate.py` | Trivial `return {}` — exists only as `interrupt_before` target |
| `ui/cards.py` | `CONCEPT_CARDS` dict — one `ConceptCard` per node explaining the primitive |
| `checkpointing/setup.py` | `make_checkpointer()` → `SqliteSaver`; `get_checkpoint_history()` |

## Environment

```bash
ANTHROPIC_API_KEY=sk-ant-...   # only required env var
```

## Models

| Agent | Model |
|-------|-------|
| Planner | `claude-haiku-4-5-20251001` |
| Synthesizer | `claude-sonnet-4-6` |

Both use `cache_control: ephemeral` on system prompts.

## HITL Flow

1. `graph.invoke(initial_state(query), config)` — runs until `interrupt_before=["review_gate"]`
2. Check `graph.get_state(config).next` — contains `"review_gate"` when interrupted
3. `graph.update_state(config, {"approval_status": "approved"})` — inject human decision
4. `graph.invoke(None, config)` — resume; `review_gate` runs, conditional edge routes to outcome

## Known Gotchas

- `review_gate` must return `{}` only — any other key written here causes unexpected state
- In simple path, `news_data` and `risk_data` stay empty; `merger` skips those sections gracefully
- `research_checkpoints.db` persists across sessions — delete it to reset all thread history
- DuckDuckGo rate-limits aggressively; if search fails, the error bubbles to Streamlit and the checkpoint resume button appears
```

- [ ] **Step 2: Run full test suite one final time**

```bash
pytest -v
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md with architecture overview, commands, HITL flow, and gotchas"
```

---

## Self-Review Checklist

- [x] **Typed State & StateReducer** → Task 2 (`state.py`, `operator.add` on `execution_trace`)
- [x] **Graph Execution & Routing** → Tasks 10–11 (`router.py`, `builder.py`, `Send()` fan-out)
- [x] **Checkpointing & Recovery** → Task 12 (`setup.py`, `SqliteSaver`, resume in Task 14 error state)
- [x] **Human-in-the-Loop** → Tasks 9, 11, 14 (`review_gate`, `interrupt_before`, `update_state`)
- [x] **Multi-Agent Orchestration** → Tasks 4–9 (Supervisor + 3 workers, non-overlapping fields)
- [x] **Debugging & Explainability** → Task 14 (time-travel debug expander, `get_state_history`)
- [x] **Concept cards** → Task 13 (`cards.py`, shown at each node in Task 14)
- [x] **Anti-patterns avoided** → Supervisor does no reasoning; workers own non-overlapping fields; routing in edges not prompts; no subgraph nesting
- [x] **All type names consistent** → `ResearchState` used throughout; `route_after_planner` / `route_after_review` match builder and test imports
