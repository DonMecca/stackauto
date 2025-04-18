# StackBounty Content Automation Engine – Progress & Changelog

## April 18, 2025

### **Recent Fixes and Improvements**
- **Prompt and Image Strategy Dropdowns:**
  - Fixed population and selection of saved prompts and image strategies from localStorage.
  - Ensured backward compatibility for previously saved items with normalization logic.
  - Now, both dropdowns initialize immediately on app load and refresh when navigating to the Options step.
- **EasyMDE Editor Integration:**
  - Markdown editors for both prompts and image strategies now use EasyMDE for editing and previewing.
  - All content is read and written directly from the EasyMDE instance, ensuring accurate saves/loads.
  - Removed all custom preview boxes in favor of EasyMDE's built-in preview.
- **UI/UX:**
  - Toolbar icons are now clearly visible with improved styling.
  - Error messages and status logs are shown in the UI to help with debugging and user feedback.
- **Bug Fixes:**
  - Prevented errors when saving image strategies by ensuring prompt content is always retrieved from EasyMDE.
  - Cleaned up debug logging and removed raw JSON output from the UI.

### **How It Works Now**
- When the app loads, both dropdowns populate with saved prompts/strategies from localStorage.
- When navigating to the Options step, dropdowns refresh to reflect any new additions or deletions.
- Saving a new prompt or image strategy updates the dropdown and persists to localStorage immediately.
- All editing is performed through EasyMDE, so formatting and previewing are consistent.

### **Known Issues / Next Steps**
- Migration of storage from localStorage to electron-store for true persistence.
- Further UI polish and workflow enhancements.
- Integration with GenSpark, OpenAI, and WordPress APIs.

---

**Commit this file with your next update to keep a running changelog.**
