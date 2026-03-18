# Agentic AI Foundation Lab

An interactive Streamlit lab for learning foundational AI concepts through
live demos, side-by-side comparisons, and step-through code walkthroughs.

## What This Lab Teaches

| Concept | Demo |
|---|---|
| AI Agent vs LLM vs Chatbot | All three demo pages |
| Deterministic vs Probabilistic | LLM vs Deterministic pages |
| Stateless vs Stateful | LLM vs Stateful Agent pages |
| Agent Roles & Responsibility Boundaries | Compare All + How It Works |

---

## Project Structure

```
agentic-ai-foundation-lab/
├── app/
│   ├── 🏠_Home.py          ← Streamlit entrypoint
│   └── pages/
│       ├── 1_🤖_LLM.py
│       ├── 2_⚙️_Deterministic.py
│       ├── 3_🧠_Stateful_Agent.py
│       ├── 4_📊_Compare_All.py
│       └── 5_📖_How_It_Works.py
├── agents/                 ← Agent logic (no UI code)
│   ├── llm_agent.py
│   ├── deterministic_agent.py
│   └── stateful_agent.py
├── utils/
│   ├── llm_client.py       ← OpenAI / Anthropic / Ollama adapter
│   └── code_steps.py       ← Step-through educational content
├── tests/                  ← pytest unit tests
└── requirements.txt
```

---

## Quick Start (Local)

**1. Clone the repo:**
```bash
git clone https://github.com/vrlnarayana/labs-for-agentic-ai.git
cd labs-for-agentic-ai
```

**2. Create and activate virtual environment (Python 3.11 required):**
```bash
python3.11 -m venv .venv
source .venv/bin/activate      # macOS/Linux
# .venv\Scripts\activate       # Windows
```

**3. Install dependencies:**
```bash
pip install -r requirements.txt
```

**4. Set up API keys:**
```bash
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# Edit .streamlit/secrets.toml — add your API key(s)
```

**5. Run the app:**
```bash
streamlit run "app/🏠_Home.py"
```

The app opens at **http://localhost:8501**

---

## API Key Setup

### Local (`.streamlit/secrets.toml`)

```toml
OPENAI_API_KEY = "sk-..."          # platform.openai.com
ANTHROPIC_API_KEY = "sk-ant-..."   # console.anthropic.com
```

### Streamlit Cloud

1. Go to your app's dashboard → **Settings → Secrets**
2. Add the same keys in TOML format

### No API Key? Use Ollama (free, local, offline)

```bash
# Install Ollama from https://ollama.com, then:
ollama pull llama3.2
ollama serve
```

Select **"ollama"** as the provider in the sidebar.

---

## Deploy to Streamlit Cloud

1. Push this repo to GitHub
2. Go to [share.streamlit.io](https://share.streamlit.io) → **New app**
3. Repo: your repo | Branch: main | **Main file: `app/🏠_Home.py`**
4. Add API keys in **Settings → Secrets**
5. Click **Deploy**

> Note: Ollama will not work on Streamlit Cloud (requires a local server). Use OpenAI or Anthropic.

---

## Run Tests

```bash
source .venv/bin/activate
pytest tests/ -v
```

Expected: 35+ tests, all passing.

---

## How to Use This in a Classroom

**Suggested page order (45-minute session):**

| Time | Page | Activity |
|---|---|---|
| 0–5 min | Home | Orient students to the 4 concepts |
| 5–10 min | LLM Demo | Ask "What is AI?" twice. Ask "What is my name?" |
| 10–15 min | Deterministic | Same questions, notice identical answers. Try out-of-scope query |
| 15–25 min | Stateful Agent | Tell it your name, ask other questions, ask "What is my name?" Clear memory, ask again |
| 25–40 min | Compare All | Run all 5 sample queries one by one, discuss "What just happened?" |
| 40–60 min | How It Works | Walk through each agent's code step-by-step |

**Discussion prompts by concept:**

- **LLM vs Agent:** "Is this LLM an agent? Why or why not? What would it need to become one?"
- **Deterministic vs Probabilistic:** "Which would you trust more for a medical diagnosis? A legal contract? A creative writing assistant?"
- **Stateless vs Stateful:** "Why do most chatbots feel like they remember you? Where is that memory actually stored?"
- **Roles & Boundaries:** "What happens if you put the memory logic inside the page instead of the agent class? Try it."
