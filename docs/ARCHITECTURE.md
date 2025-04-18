# SCAE Architecture

## Current Status (April 2025)
- Electron app scaffolded and running
- Multi-step workflow UI implemented
- CRUD for GenSpark prompts and image strategies (title + content) via localStorage (mocked)
- Repo is on [GitHub](https://github.com/DonMecca/stackauto)

## Next Steps
- Migrate prompt/strategy storage to `electron-store`
- Integrate GenSpark, OpenAI, and WordPress APIs
- Further UI/UX and workflow enhancements

## Electron Process Model
- **Main Process:** Handles backend logic (API calls, file system, scraping, orchestration).
- **Renderer Process:** Manages the UI (HTML/CSS/JS or framework).
- **IPC/ContextBridge:** Secure communication between renderer and main process.

## Key Modules/Services
- `GenSparkClient`: Handles GenSpark API requests and response parsing.
- `OpenAIClient`: Manages image processing/generation via OpenAI.
- `WordPressClient`: Authenticates and posts content/images to WordPress.
- `ScraperService`: Scrapes AppSumo URLs for metadata/images.
- `ConfigManager`: Manages `electron-store` config, including API keys, prompts, strategies, and logo path.
- `WorkflowOrchestrator`: Coordinates the end-to-end workflow.

## Data Flow
1. User inputs data in renderer UI.
2. Renderer sends requests (via IPC) to the main process.
3. Main process orchestrates scraping, AI calls, image processing, and WordPress publishing.
4. Results/status/errors are sent back to renderer for display.

## Local Storage Structure
- **Config:** `electron-store` (`config.json`)
- **History:** `history.json`
- **Artifacts:**
  - `/artifacts/markdown/` — Generated Markdown article backups
  - `/artifacts/images/` — Generated and processed images
- **Logs:** `/logs/` — App events and errors
- **Config:** `/config/` — (If needed) for advanced or externalized config files

### Folder Layout Diagram

```
/project-root
├── artifacts/
│   ├── markdown/
│   └── images/
├── logs/
├── config/
├── docs/
└── ...
```

### Diagrams
- For UI or workflow diagrams, add images or ASCII art here or in a new `/docs/DIAGRAMS.md` file.

---

## Migration Considerations

The current SCAE architecture is optimized for Electron desktop use. Key business logic is organized into separate modules for maintainability and clarity, but not with strict separation between backend and UI. If a server/web migration is needed in the future, some refactoring will be necessary to extract backend logic, adapt configuration, and rework UI/backend communication. This organization is intended to make such a transition easier, but the current focus is on rapid, beginner-friendly desktop development.

- **What’s done now:**
  - Code is organized by logical responsibility (scraper, API clients, config manager, etc.)
  - Paths and settings are configurable
  - No REST API or HTTP server is implemented
  - No server/web authentication or cloud storage logic
- **What would be needed for migration:**
  - Extract backend modules for use in a Node.js server
  - Adapt configuration for environment variables or cloud secret managers
  - Replace Electron-specific APIs with Node.js/web equivalents
  - Rework UI/backend communication (IPC → HTTP/WebSocket)
  - Add server/web authentication and possibly multi-user logic
