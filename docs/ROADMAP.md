# SCAE Roadmap

## MVP Scope
- Main UI, manual workflow, settings, prompt/strategy management, core automation, logging/history

## Planned V2 Features
- AppSumo deal monitoring/queue
  - Background service to scrape new deals from AppSumo
  - Queue new deals, avoid duplicates, and notify user in-app
  - UI for reviewing and processing queued deals
- Local (non-AI) image manipulation (e.g., sharp overlay)
- Enhanced error handling and feedback
- OS keychain integration
  - Store API keys and passwords securely using the OS keychain (e.g., `keytar`)
  - Fallback to `electron-store` if unavailable
- In-app Markdown editor

## Future Ideas
- Advanced scheduling/automation
- Multi-site WordPress publishing
- User roles/permissions
