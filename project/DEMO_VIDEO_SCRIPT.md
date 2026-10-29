# Somnia 3-Minute Video Demo Script 🎬
*Nebius × NVIDIA Global AI Hackathon (Personal AI Track)*
*Total Target Runtime: ~2 minutes 45 seconds (Hard limit: < 3 minutes)*

---

### Tips Before Recording
* Open the browser at `http://localhost:5173`.
* Set your screen recorder to 1080p (60fps recommended).
* Speak clearly at a calm, confident pace.
* Pre-populate 1 or 2 sample memories (e.g. "I study best in 50-minute blocks with no phone") and a sample decision in the Decision Journal.

---

### Video Script Breakdown

#### ⏱️ 0:00 – 0:25 | Hook & The Problem
* **On Screen:** Start on Somnia's clean Dashboard with the dark `somnia` theme glowing softly.
* **Narration:**  
  *"Today, personal AI assistants demand everything: your thoughts, notes, and private data, locked away on cloud servers where you have zero control over how they are used.  
  Meet **Somnia**—a local-first personal reflection engine built for the Nebius × NVIDIA Global AI Hackathon, designed to give you clarity and memory under your absolute control."*

---

#### ⏱️ 0:25 – 0:55 | User-Governed Memory CRUD
* **On Screen:** Click on the **Memories** tab on the navigation sidebar. Show existing memories. Click "+ Add Memory", type:  
  `"I do my best creative writing early in the morning before checking email."`  
  Show the memory appear with status `approved`. Show the toggle/archive button.
* **Narration:**  
  *"Unlike other assistants that secretly scrape what you say, Somnia's memory is 100% user-governed. You create, edit, approve, and archive memories. Only approved memories can ever be referenced by the AI—archived thoughts remain strictly private on your machine."*

---

#### ⏱️ 0:55 – 1:30 | Decision Journal & Cognitive Sleep Cycle
* **On Screen:** Navigate to **Decision Journal**. Show a logged decision (e.g., *"Choosing between two tech stacks"*). Next, navigate to the **Sleep Cycle** screen. Click the **"Run Sleep Cycle Review"** button. The screen updates to show the Morning Report and stale memory review.
* **Narration:**  
  *"Somnia also functions as a metacognitive workspace. In the Decision Journal, you log critical decisions, your underlying reasoning, and expected outcomes to review later.  
  And when you run Somnia's Sleep Cycle, our background engine reviews your approved memories, flagging entries that haven't been touched in over 180 days so you can declutter your digital mind."*

---

#### ⏱️ 1:30 – 2:15 | Nebius Token Factory & NVIDIA Nemotron in Action
* **On Screen:** Click on the **Chat** screen. Point out the header indicator:  
  *(If in Demo Mode, show the prompt suggestion "Help me plan my day". If connected with key, show `Connected to Nebius Token Factory (nvidia/nemotron-3-super-120b-a12b)`).*  
  Type in the chat input:  
  `"How should I structure my study routine tomorrow based on what you know about me?"`  
  Send the message. Watch the typing indicator and the response arrive with the relevant memory applied.
* **Narration:**  
  *"Now let's see Somnia's intelligence. Somnia connects to **Nebius Token Factory**, powered by the open-source **NVIDIA Nemotron** model (`nvidia/nemotron-3-super-120b-a12b`).  
  Notice how the model reasons strictly over my user-approved study preferences, citing only what I've authorized, while maintaining transparency about uncertainty."*

---

#### ⏱️ 2:15 – 2:40 | Privacy Settings & Offline Demo Mode
* **On Screen:** Navigate to **Settings & Privacy**. Toggle the "Allow External AI Sharing" switch off. Switch themes to show `neural` or `cosmic`. Show the "Export Data (JSON)" button.
* **Narration:**  
  *"Data sovereignty is built into every layer. With one click in Settings, I can sever external AI communication. When offline, Somnia smoothly drops back into an offline Demo Mode with simulated responses—zero errors, zero lock-in, and ₹0 budget required. All data lives in a local SQLite database that never leaves this computer."*

---

#### ⏱️ 2:40 – 2:55 | Conclusion & Call to Action
* **On Screen:** Return to the Dashboard or GitHub repository page showing the MIT license and test suite results.
* **Narration:**  
  *"Somnia proves that personal AI can be powerful, beautiful, and private by putting the user in control, backed by NVIDIA Nemotron and Nebius Token Factory.  
  Thank you for watching—check out our open-source repository on GitHub!"*

