const { ClaudeAI } = require('./claude');
const fs = require('fs');
const path = require('path');

class SOPManager {
  constructor() {
    this.sopDir = path.join(__dirname, '../sops');
    if (!fs.existsSync(this.sopDir)) {
      fs.mkdirSync(this.sopDir, { recursive: true });
    }
  }

  sanitizeFilename(topic) {
    return topic.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 50);
  }

  async getOrCreate(topic) {
    const filename = this.sanitizeFilename(topic) + '.md';
    const filepath = path.join(this.sopDir, filename);

    // Check if SOP already exists
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf-8');
      return `📁 **Existing SOP loaded:**\n\n${content}`;
    }

    // Generate new SOP using AI
    const claude = new ClaudeAI();
    const sop = await claude.generateSOP(topic);

    // Save it for future use
    fs.writeFileSync(filepath, sop, 'utf-8');

    return `✨ **New SOP created & saved:**\n\n${sop}`;
  }

  listSOPs() {
    try {
      return fs.readdirSync(this.sopDir)
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', '').replace(/_/g, ' '));
    } catch {
      return [];
    }
  }
}

module.exports = { SOPManager };
