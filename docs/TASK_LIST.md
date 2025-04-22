# SCAE Task List

## Legend
- [ ] Not Started
- [~] In Progress
- [✓] Complete
- [T] Test Required/Complete

---

## Agile, Detailed Task Breakdown

### 1. Project Initialization & Scaffolding
- [✓] Initialize Git repository and configure `.gitignore` [T]
- [✓] Set up Electron project structure (main/renderer, IPC config) [T]
- [✓] Set up basic npm scripts and dependency management [T]
- [✓] Add ESLint/Prettier configuration for code quality [T]

### 2. Core UI Shell
- [✓] Build main window HTML/CSS/JS (basic layout, status bar, menu) [T]
- [✓] Implement IPC communication bridge (contextBridge) [T]
- [✓] Create placeholder components for all main UI sections [T]

### 3. Configuration & Settings
- [ ] Integrate `electron-store` for persistent config [T]
- [ ] Build Settings UI (API keys, logo path, default strategies) [T]
- [ ] Validate and securely store sensitive fields [T]
- [ ] Add tests for config read/write and validation

### 4. Prompt/Strategy Management
- [✓] Design prompt and image strategy data models [T]
- [✓] Implement CRUD UI for prompts/strategies (mocked in localStorage for now) [T]
- [~] Wire up logic to `electron-store` [T]  <!-- In progress: currently using localStorage, will migrate to electron-store -->
- [ ] Populate initial default prompts/strategies [T]
- [ ] Add tests for CRUD operations and default selection

### 5. AppSumo Scraper Module
- [ ] Implement `ScraperService` for metadata/image extraction [T]
- [ ] Add robust URL validation and error handling [T]
- [ ] Write unit tests for scraping logic and edge cases

### 6. GenSpark API Integration
- [ ] Implement `GenSparkClient` (request/response, error handling) [T]
- [ ] Inject dynamic prompt values (AppSumo URL) [T]
- [ ] Parse and validate API response (title, body, tags, etc.) [T]
- [ ] Write integration tests for GenSpark API

### 7. OpenAI Image Processing Module
- [ ] Implement `OpenAIClient` for all strategy types [T]
- [ ] Handle image download, AI modification, and generation [T]
- [ ] Add fallback logic for failures [T]
- [ ] Write tests for each image strategy and error/fallbacks

### 8. WordPress Integration
- [ ] Implement `WordPressClient` (auth, media upload, post creation) [T]
- [ ] Map categories/tags to IDs; handle missing terms [T]
- [ ] Add comprehensive error handling and logging [T]
- [ ] Write integration tests for publishing workflow

### 9. Workflow Orchestration
- [✓] Fix workflow navigation ("Next"/"Previous" buttons, step transitions, UI feedback) [T] **(April 21-22, 2025: Complete, see PROGRESS.md)**
- [✓] Debug and resolve cookie management UI and dropdown selection [T] **(April 21-22, 2025: Complete)**
- [ ] Implement `WorkflowOrchestrator` to sequence all modules [T]
- [ ] Ensure UI state reflects backend progress [T]
- [ ] Add tests for full workflow (mocked APIs)

### 10. Logging & History
- [ ] Integrate `winston` or `pino` for structured logging [T]
- [ ] Implement history log (`history.json`) [T]
- [ ] Add tests for logging and history record creation

### 11. UI/UX Enhancements & Error Feedback
- [ ] Add loading/progress indicators to all async actions [T]
- [ ] Ensure all errors are surfaced in UI clearly [T]
- [ ] Add tests for UI feedback and error scenarios

### 12. Manual QA & End-to-End Testing
- [ ] Perform manual QA on all major workflows [T]
- [ ] Write end-to-end (E2E) tests for the complete content creation and publishing flow [T]

---

## Status Board

| Task | Status |
|------|--------|
| Project Initialization & Scaffolding | [ ] |
| Core UI Shell | [ ] |
| Configuration & Settings | [ ] |
| Prompt/Strategy Management | [ ] |
| AppSumo Scraper Module | [ ] |
| GenSpark API Integration | [ ] |
| OpenAI Image Processing Module | [ ] |
| WordPress Integration | [ ] |
| Workflow Orchestration | [ ] |
| Logging & History | [ ] |
| UI/UX Enhancements & Error Feedback | [ ] |
| Manual QA & End-to-End Testing | [ ] |
