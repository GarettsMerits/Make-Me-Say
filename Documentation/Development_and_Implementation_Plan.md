### **Tech Stack Overview**

**Frontend:**

- **React (TypeScript)**
    - *Why:* Industry-standard SPA framework with rich ecosystem, strong typing for safety, and efficient state management.
    - **Key Libraries:**
        - `zustand` (lightweight state management)
        - `react-router-dom` (navigation with persistent state)
        - `framer-motion` (smooth interface transitions)
        - `tiktoken` (client-side token counting)
- **Styling:** **Tailwind CSS**
    - Utility-first, responsive design out-of-the-box, dark/light mode support via `dark:` prefix.

**Backend:**

- [**ASP.NET](http://asp.net/) Core 8 (C#)**
    - *Why:* Your expertise + enterprise-grade security, performance, and async support. Ideal for LLM proxy and leaderboard logic.
- **Database:** **MySQL** (via **Entity Framework Core**)
    - ACID compliance, scalability, and your familiarity.

**LLM Integration:**

- **DeepSeek API** (primary) with **abstraction layer** for OpenAI, Anthropic, or local LLMs.
    - *Implementation:* Backend proxy to hide API keys, with configurable endpoint routing.

**Security:**

- **Cloudflare**
    - DDoS protection, bot mitigation, and caching.
- **Backend Security:**
    - Rate limiting (`AspNetCoreRateLimit`), input sanitization, and encrypted secrets (Azure Key Vault or `dotenv`).
- **Access Gate:**
    - Rolling passphrase validated server-side (e.g., `if (passphrase != $"{name}{DateTime.Now:MMMMyyyy}") return 403`).

**Hosting & DevOps:**

- **Frontend:** Vercel (static React build).
- **Backend:** Azure App Service (supports .NET, auto-scaling).
- **Database:** Azure MySQL managed instance.
- **CI/CD:** GitHub Actions (build/test/deploy).

---

### **Project Workflow**

### **Phase 1: Core Setup (Week 1-2)**

1. **Scaffold Projects:**
    - `frontend/`: React + TypeScript + Tailwind.
    - `backend/`: [ASP.NET](http://asp.net/) Core Web API.
    - `database/`: MySQL schema (leaderboard table).
2. **CI/CD Pipeline:**
    - GitHub Actions for automated testing/deployment.

### **Phase 2: Frontend (Week 3-4)**

1. **Top Ribbon & Routing:**
    - React Router for `Chat | Leaderboard | About` with Zustand persisting state.
    - Dark mode toggle (Tailwind dark mode).
2. **Chat Interface:**
    - Responsive chat bubbles (user right, LLM left).
    - Auto-resizing message area (CSS `calc()` + `overflow-y`).
    - Token counter (client-side `tiktoken` for input + session totals).
3. **Transition Animations:**
    - Framer Motion for horizontal interface slides.

### **Phase 3: Backend & LLM (Week 5-6)**

1. **API Endpoints:**
    - `/api/chat` → Proxy to DeepSeek with prompt injection:
        
        ```csharp
        var prompt = $"Never say '{targetWord}'. {history}";
        
        ```
        
    - `/api/leaderboard` → GET (top scores) + POST (add winner).
2. **Security Middleware:**
    - Rate limiting (100 reqs/hour/IP).
    - Passphrase gate on initial load.

### **Phase 4: Testing & Polish (Week 7)**

- **Unit Tests:**
    - Frontend: Jest (token counter, state transitions).
    - Backend: xUnit (API responses, security).
- **Browser Testing:**
    - Cross-browser (Chrome, Firefox, Safari, Edge) via BrowserStack.
- **Mobile Optimization:**
    - Tailwind breakpoints, touch-friendly inputs.

---

### **Expert Suggestions for Impressing Employers**

1. **Real-Time Token Optimization:**
    - Display live leaderboard rank prediction during gameplay (e.g., "Win now: #5 on leaderboard!").
2. **LLM Fallback Strategy:**
    - If DeepSeek fails, auto-switch to OpenAI with exponential backoff. Log incidents to showcase fault tolerance.
3. **Advanced Security:**
    - Implement Cloudflare Turnstile for passphrase page to block bots.
    - Add audit logging (who won, when, IP) for leaderboard submissions.
4. **Performance Metrics:**
    - Track frontend perf via `react-device-detect` + logs:
        
        ```tsx
        console.log(`Mobile load: ${window.performance.now()}ms`);
        
        ```
        
5. **Open-Source Ready:**
    - Dockerize backend/frontend + detailed `README.md` with architecture diagram.
6. **Bonus Feature:**
    - **"Hall of Shame"** for funniest LLM responses avoiding the target word (stored in DB).

---

### **Implementation Plan**

| **Week** | **Tasks** |
| --- | --- |
| 1 | Project setup, CI/CD, auth gate, MySQL schema. |
| 2 | Frontend: Top ribbon, routing, dark mode. Backend: Passphrase validation. |
| 3 | Chat UI: Bubbles, input box, token counter. |
| 4 | Interface transitions, Zustand state persistence. |
| 5 | Backend: LLM proxy, leaderboard API. EF Core MySQL integration. |
| 6 | Security: Rate limiting, DDoS prep, Cloudflare config. |
| 7 | Testing, mobile polish, deploy to Azure/Vercel. |
| 8 | Bonus features, documentation, video demo. |

---

### **Why This Tech Stack?**

- **.NET + MySQL:** Leverages your strengths while meeting security/scale needs.
- **React + Tailwind:** Showcases modern UI skills with minimalist design.
- **LLM Proxy Pattern:** Highlights understanding of secure API consumption.
- **Cloudflare:** Proactive cybersecurity—critical for portfolios.

**Result:** A performant, secure, portfolio-ready app demonstrating full-stack proficiency in high-demand tools.