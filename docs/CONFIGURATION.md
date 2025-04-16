# SCAE Configuration

## Managed via `electron-store` (`config.json`)

### Keys & Structure
- **GenSpark API Key**
- **OpenAI API Key**
- **WordPress Site URL**
- **WordPress Application Password**
- **StackBounty Logo File Path**
- **Default Image Dimensions** (e.g., 1920x1080)
- **GenSparkPrompts**: Array of `{ id, name, content, isDefault }`
- **OpenAIImageStrategies**: Array of `{ id, name, actionType, promptContent, isDefault }`
- **DefaultGenSparkPromptId**
- **DefaultImageStrategyId**

### Configuration UI
- All values settable via Settings screen in the app
- API keys/passwords stored securely (keychain integration in future)

### Security Notes
- Credentials are never hardcoded
- Sensitive fields (API keys, passwords) are stored in the OS keychain (e.g., via `keytar`) when available
- If OS keychain is unavailable, fallback to encrypted storage in `electron-store`
- Users can manage credentials via the Settings UI
