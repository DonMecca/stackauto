# 📘 StackBounty Content Automation App – API Integration Guide

This document provides comprehensive guidance on integrating the following APIs into the StackBounty Content Automation App:

- [GenSpark API](#genspark-api)
- [OpenAI API](#openai-api)
- [WordPress REST API](#wordpress-rest-api)

---

## 🔑 GenSpark API

**Overview:**  
The GenSpark API is used to generate SEO-optimized, high-converting review articles based on AppSumo product URLs.

**Authentication:**  
- Obtain your API key from the [GenSpark Dashboard](https://www.genspark.ai/).
- Include the API key in the `Authorization` header of your requests.

**Endpoint:**  
```
POST https://api.genspark.ai/v1/generate
```

**Request Headers:**
```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "prompt": "Write a long-form, SEO-optimized review article about the app [APP NAME], currently offering a lifetime deal on AppSumo. ...",
  "parameters": {
    "model": "genspark-default",
    "temperature": 0.7,
    "max_tokens": 2048
  }
}
```

**Response Example:**
```json
{
  "article": {
    "title": "Unlocking Productivity with [APP NAME]",
    "body": "In today's fast-paced digital world, [APP NAME] offers a comprehensive solution...",
    "category": "Productivity Tools",
    "tags": ["AppSumo", "[APP NAME]", "Lifetime Deal", "Productivity"],
    "affiliate_link": "https://go.stackbounty.com/appname"
  }
}
```

**Notes:**
- Ensure the prompt is dynamically generated based on the AppSumo product URL.
- Handle rate limits and errors as per the API documentation.

---

## 🧠 OpenAI API

**Overview:**  
The OpenAI API, specifically GPT-4o, is utilized to generate featured images for the blog posts.

**Authentication:**  
- Obtain your API key from the [OpenAI Platform](https://platform.openai.com/account/api-keys).
- Include the API key in the `Authorization` header of your requests.

**Endpoint:**  
```
POST https://api.openai.com/v1/images/generations
```

**Request Headers:**
```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "prompt": "Design a 16:9 featured image for [APP NAME] review, incorporating the app's logo and a modern, tech-savvy aesthetic.",
  "n": 1,
  "size": "1024x576"
}
```

**Response Example:**
```json
{
  "data": [
    {
      "url": "https://openai.com/generated-images/image1.png"
    }
  ]
}
```

**Notes:**
- Ensure that the prompt includes specific instructions to match the StackBounty branding.
- Download and store the generated image for use in the WordPress post.

---

## 📝 WordPress REST API

**Overview:**  
The WordPress REST API is used to publish the generated articles and images to the StackBounty WordPress site.

**Authentication:**  
- Use Basic Authentication or OAuth 2.0.
- For Basic Auth, include the username and password in the request headers.

**Endpoint:**  
```
POST https://yourwordpresssite.com/wp-json/wp/v2/posts
```

**Request Headers:**
```http
Authorization: Basic BASE64_ENCODED_CREDENTIALS
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "title": "Unlocking Productivity with [APP NAME]",
  "content": "<p>In today's fast-paced digital world, [APP NAME] offers...</p>",
  "status": "publish",
  "categories": [12],
  "tags": [34, 56],
  "featured_media": 78
}
```

**Uploading Media:**
To upload the featured image:

**Endpoint:**
```
POST https://yourwordpresssite.com/wp-json/wp/v2/media
```

**Request Headers:**
```http
Authorization: Basic BASE64_ENCODED_CREDENTIALS
Content-Disposition: attachment; filename="featured-image.png"
Content-Type: image/png
```

**Request Body:**
- Binary data of the image file.

**Response:**
- The response will include the `id` of the uploaded media, which should be used as the `featured_media` in the post creation request.

**Notes:**
- Ensure that the category and tag IDs correspond to existing terms in your WordPress site.
- Handle authentication securely and avoid exposing credentials.

---

## 🔄 Workflow Summary

1. **Input:** User provides an AppSumo product URL and uploads the app's logo.
2. **Article Generation:** Send a prompt to the GenSpark API to generate the article.
3. **Image Generation:** Use the OpenAI API to create a featured image based on the app's branding.
4. **Media Upload:** Upload the generated image to WordPress and retrieve the media ID.
5. **Post Creation:** Publish the article to WordPress with the appropriate metadata and featured image.

---

## 📌 Additional Resources

- [GenSpark API Documentation](https://www.genspark.ai/)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [WordPress REST API Handbook](https://developer.wordpress.org/rest-api/)

---

Please ensure that all API keys and credentials are stored securely and not hard-coded into the application. Implement proper error handling and logging to facilitate debugging and maintenance.
