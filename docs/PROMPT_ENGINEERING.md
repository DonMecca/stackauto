# SCAE Prompt Engineering

## GenSpark Prompts
- Stored as templates with `{{APP_SUMO_URL}}` placeholder
- Users can create, edit, and set default prompts
- Example placeholder usage: `Write a review for {{APP_SUMO_URL}}...`

## OpenAI Image Strategies
- Each strategy has:
  - **Name**
  - **Action Type:**
    - Use Original Scraped Image
    - Modify Image with AI Prompt
    - Generate New Image with AI Prompt
  - **Prompt Content:** May include `{{SCRAPED_PRODUCT_IMAGE_URL}}`, `{{STACKBOUNTY_LOGO_URL}}`
- Example: "Add the logo at {{STACKBOUNTY_LOGO_URL}} to the image at {{SCRAPED_PRODUCT_IMAGE_URL}}."

## Tips
- Always use required placeholders
- Be explicit in instructions for AI image editing/generation
