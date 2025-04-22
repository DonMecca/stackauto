# StackBounty Content Automation Engine (SCAE)

This directory contains documentation for SCAE.

- [Project Overview](./PROJECT_OVERVIEW.md)
- [Architecture](./ARCHITECTURE.md)
- [Tech Stack](./TECH_STACK.md)
- [Configuration](./CONFIGURATION.md)
- [API Integrations](./API_INTEGRATIONS.md)
- [Prompt Engineering](./PROMPT_ENGINEERING.md)
- [Task List](./TASK_LIST.md)
- [Roadmap](./ROADMAP.md)
- [Logging & Error Handling](./LOGGING_ERROR_HANDLING.md)
- [PROGRESS & Changelog](../PROGRESS.md)

For setup and usage, see the main [`README.md`](../README.md).

**Note:** Prompt and image strategy management is now robust, with dropdowns and editing fully powered by EasyMDE. See PROGRESS.md for recent changes.

## April 2025 – Workflow Navigation & Cookie Management

April 21-22: Major bugfixes for workflow navigation and cookie management. The "Next" button now reliably advances steps, cookie dropdown and management UI is fully functional, and error handling is improved. See [PROGRESS.md](./PROGRESS.md) for ongoing troubleshooting and detailed updates.

We are currently debugging a timing/race condition affecting the clipboard extraction method in the GenSpark automation workflow. A polling-based clipboard read was implemented to improve reliability, but the clipboard content is still sometimes not detected. See PROGRESS.md for ongoing updates.
