// WordPressClient: Authenticates and posts content/images to WordPress

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

class WordPressClient {
  constructor(config) {
    this.siteUrl = config.wordpressSiteUrl.replace(/\/$/, '');
    this.appPassword = config.wordpressAppPassword;
    this.username = config.wordpressUsername;
  }

  getAuthHeader() {
    // WordPress App Passwords: username:app_password (base64)
    const token = Buffer.from(`${this.username}:${this.appPassword}`).toString('base64');
    return `Basic ${token}`;
  }

  async uploadMedia(imagePath) {
    // Upload image to /wp/v2/media
    const url = `${this.siteUrl}/wp-json/wp/v2/media`;
    const fileName = path.basename(imagePath);
    const fileData = fs.readFileSync(imagePath);
    let mimeType = 'image/jpeg';
    if (fileName.endsWith('.png')) mimeType = 'image/png';
    if (fileName.endsWith('.gif')) mimeType = 'image/gif';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Type': mimeType,
        },
        body: fileData
      });
      if (!res.ok) throw new Error(`Media upload failed: ${res.status} ${res.statusText}`);
      const json = await res.json();
      return { mediaId: json.id, url: json.source_url };
    } catch (err) {
      return { error: err.message };
    }
  }

  async createPost(postData) {
    // postData: { title, content, excerpt, status, categories, tags, featured_media }
    const url = `${this.siteUrl}/wp-json/wp/v2/posts`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData)
      });
      if (!res.ok) throw new Error(`Post creation failed: ${res.status} ${res.statusText}`);
      const json = await res.json();
      return { postId: json.id, url: json.link };
    } catch (err) {
      return { error: err.message };
    }
  }
}


module.exports = WordPressClient;
