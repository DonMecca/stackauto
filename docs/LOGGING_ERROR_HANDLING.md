# SCAE Logging & Error Handling

## Logging
- **Library:** winston or pino
- **Files:** Local log files for errors/events
- **Format:** Timestamped JSON or human-readable
- **Categories:**
  - Workflow events
  - API errors
  - Scraping errors
  - Image processing errors
  - Publishing errors

## Error Handling
- User-friendly error messages in UI
- Fallback strategies (e.g., use original image if AI fails)
- Log all errors with details
- History log (`history.json`) records status and errors per AppSumo URL
