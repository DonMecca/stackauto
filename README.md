# StackBounty Content Automation Engine (SCAE)

## Current Status (April 2025)
- Electron app scaffolded and running
- Multi-step workflow UI implemented
- Full CRUD for GenSpark prompts and image strategies (title + content) via localStorage (mocked)
- ESLint/Prettier configuration present
- Project initialized and pushed to [GitHub](https://github.com/DonMecca/stackauto)

## Next Steps
- Migrate prompt/strategy storage to `electron-store` for persistence
- Integrate GenSpark, OpenAI, and WordPress APIs
- Enhance UI/UX and workflow polish

## StackBounty Content Automation Engine (SCAE)

A cross-platform ElectronJS desktop app to automate the creation and publishing of SEO-optimized AppSumo product review blog posts for StackBounty.

- **Project Overview:** See [`/docs/PROJECT_OVERVIEW.md`](./docs/PROJECT_OVERVIEW.md)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the app:
   ```bash
   npm start
   ```

## Usage
- Input an AppSumo URL and select prompts/strategies.
- Generate article and image, review, and post to WordPress.
- Configure API keys and settings via the Settings menu.

For more, see `/docs/PROJECT_OVERVIEW.md` and other docs in `/docs`.
