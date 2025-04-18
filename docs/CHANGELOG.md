# SCAE Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]
- Ongoing development, see `/docs/TASK_LIST.md` for current progress.

## [1.4.0] – 2025-04-18
### Changed
- Fixed population and selection of saved prompts and image strategies in dropdowns.
- Ensured backward compatibility for previously saved items.
- Now both dropdowns initialize on app load and refresh on Options step navigation.
- EasyMDE is now the single source for editing and saving prompt/image content.
- UI/UX improvements: toolbar icons visible, error/status logs in the UI, custom preview boxes removed.
- Bug fix: image strategy save always uses EasyMDE content.
- Debug logging and raw JSON output removed from UI.

See `PROGRESS.md` for full details.

## [1.3.0] – 2025-04-16
### Added
- Initial documentation suite (`README.md`, `/docs/*`)
- Project overview, architecture, tech stack, configuration, API integrations, prompt engineering, roadmap, task list, and logging/error handling docs
- Populated `/docs/API_INTEGRATIONS.md` with detailed API usage and sample code

### Planned
- MVP application scaffolding and UI shell
- Settings, prompt/strategy management, and workflow modules
