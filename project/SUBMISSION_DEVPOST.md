# Devpost Submission Package for Somnia 🌙
*Nebius × NVIDIA Global AI Hackathon*

---

### Basic Info
* **Project Name:** Somnia
* **Elevator Pitch / Tagline (Under 100 characters):**  
  *Privacy-first personal reflection AI powered by Nebius Token Factory and NVIDIA Nemotron.*
* **Selected Track:** **Personal AI Track**  
  *(Mission: Build an always-on, private assistant that operates under the user's control with persistent memory, custom data access, and daily reflection workflows).*

---

### Project Description

#### 💡 Inspiration
Today's personal assistants operate on an extractive premise: to help you, they demand total access to your thoughts, notes, and habits, storing them on proprietary cloud servers where they are mined or silently fed into training sets. We asked: *Can we create an AI assistant that provides deep cognitive clarity, structured memory, and decision journaling without ever compromising the user's data sovereignty?* 

That is why we built **Somnia**—a local-first personal reflection engine where memory is user-governed, privacy is non-negotiable, and intelligence is powered by open-source foundation models via Nebius Token Factory.

---

#### 🛠️ What It Does
Somnia combines personal reflection, daily productivity, and sovereign AI into an intuitive workspace:

1. **User-Governed Memory CRUD:** You have ultimate authority over the AI's memory. Add, edit, approve, archive, or delete memories. The AI never creates unverified memories on its own.
2. **Context-Guarded AI Chat:** When speaking with Somnia, only approved memories and relevant past decisions matching your query are retrieved into the prompt context. Archived records and personal notes are strictly quarantined.
3. **NVIDIA Nemotron via Nebius Token Factory:** Integrates the high-performance open-source `nvidia/nemotron-3-super-120b-a12b` model through Nebius Token Factory's low-latency API endpoint.
4. **Cognitive Sleep Cycle Review:** A deterministic background review that identifies memories that haven't been reviewed or updated in over 180 days, allowing users to keep their mind and memory footprint tidy.
5. **Decision Journal:** Record high-stakes decisions, your reasoning, options considered, and expected outcomes, with scheduled retrospective reviews to calibrate your judgment over time.
6. **Graceful Zero-Cost Local Demo Mode:** If external AI credentials are not provided or if the user chooses to stay offline, Somnia provides instant, illustrative canned responses without crashing or forcing paid subscriptions.

---

#### 🏗️ How We Built It
* **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide icons, and Vite 7. We implemented 4 tailored aesthetic themes (`somnia`, `neural`, `cosmic`, `quantum`) and an optimistic dual-layer storage model that mirrors backend updates to browser `localStorage`.
* **Backend:** Built with modern Node.js 22 leveraging native `node:sqlite` (DatabaseSync) and the built-in HTTP server. The backend enforces loopback security (`127.0.0.1`), verifying Origin and Host headers to guard against unauthorized local cross-origin access.
* **AI Provider Pipeline:** We constructed a resilient client targeting Nebius Token Factory's `/v1/chat/completions` endpoint. It formats NVIDIA Nemotron system prompts, injects token-matched approved memories, enforces 30-second abort timeouts, and provides user-controlled consent gates.
* **Database & Memory Schema:** SQLite tables for `memories`, `decisions`, `reminders`, `messages`, and `sleep_runs` with indexing on status and timestamps.

---

#### ⚡ How Nebius and NVIDIA Are Used
Somnia is integrated directly with **Nebius Token Factory**, calling its OpenAI-compatible endpoint at `https://api.tokenfactory.nebius.com/v1/chat/completions`. We utilize NVIDIA's flagship open-source reasoning model:
* **Model:** `nvidia/nemotron-3-super-120b-a12b`
* **Role in Architecture:** Powering the personal reflection and chat agent, reasoning over user-approved memories and past decision logs while adhering strictly to uncertainty framing and anti-hallucination system constraints.

---

#### 🧗 Challenges We Ran Into
* **Ensuring Privacy in Context Injection:** Ensuring that archived or sensitive memories never slip into prompt payloads required rigorous lexical tokenization and status validation before context assembly.
* **Zero-Budget Constraint:** We wanted any developer or student to run and test Somnia without being forced into surprise cloud bills. We solved this by developing a dual-mode architecture: 100% offline mock-tested test suites and a safe, opt-in smoke test for Nebius Token Factory.
* **Sleep Cycle Idempotency:** Guaranteeing that repeated triggers of the staleness review would not duplicate records or cause race conditions, achieved using cryptographic idempotency keys in SQLite transactions.

---

#### 🏆 Accomplishments We're Proud Of
* **3 passing backend test suites** running in under 2 seconds with zero paid network dependencies.
* **True data ownership:** All data remains on the user's computer in a standard SQLite file.
* **Seamless Nebius Token Factory + NVIDIA Nemotron integration** with clear in-UI status indicators.

---

#### 📚 What We Learned
* How to leverage open-source models like NVIDIA Nemotron through high-speed serverless inference on Nebius Token Factory.
* How to design privacy-preserving context pipelines that empower users to curate what the AI knows.
* Best practices for combining Node 22 native features (`node:sqlite`) with React and Vite.

---

#### 🔮 What's Next for Somnia
* Local on-device inference using quantized NVIDIA Nemotron via WebGPU/Ollama.
* Local vector embeddings for semantic memory clustering while maintaining 100% offline privacy.
* Cross-device peer-to-peer encrypted synchronization.

---

### 🏷️ Built With Tags
`nebius-token-factory`, `nvidia`, `nvidia-nemotron`, `react`, `typescript`, `vite`, `nodejs`, `sqlite`, `tailwind-css`, `personal-ai`

