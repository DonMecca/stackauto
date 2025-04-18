# StackBounty Content Automation Engine (SCAE) – Project Overview

## Objective
SCAE is a cross-platform ElectronJS desktop application designed to automate and streamline the creation of SEO-optimized product review blog posts for StackBounty. The tool ingests an AppSumo deal URL, leverages GenSpark AI for content generation, processes the featured image (optionally adding branding via OpenAI or using it as-is), and publishes the final artifact to a designated WordPress instance.

## Target User
- **Content Editor (Admin):** Responsible for initiating content generation, reviewing/editing outputs, and publishing to WordPress.

## Core Problem
Manual production of AppSumo review posts is time-consuming and inconsistent. SCAE reduces manual effort, ensures quality/SEO, and accelerates the publishing workflow.

## Key Features
- Input and validation of AppSumo URLs
- Metadata scraping (product name, featured image)
- GenSpark AI-powered content generation
- Flexible image processing strategies (use, modify, or generate via OpenAI)
- User review and manual override of generated content
- One-click WordPress publishing (draft or publish)
- Prompt/strategy management UI (now with reliable dropdowns, EasyMDE-based editing, and full CRUD)
- Settings/configuration UI (API keys, logo path, etc.)
- Local logging and history tracking
- All prompt/image strategy content is stored in localStorage for now (migration to electron-store planned)

## MVP Scope
- Electron app with main UI shell
- Manual AppSumo URL input
- Settings and prompt/strategy management (with robust dropdowns and EasyMDE integration)
- Core workflow: scrape, generate, process image, preview, and post
- Logging and local history

## Future Considerations (V2+)
- Automated AppSumo deal monitoring/queue
- Enhanced error handling and feedback
- Local (non-AI) image manipulation
- OS keychain integration
- In-app Markdown editor
