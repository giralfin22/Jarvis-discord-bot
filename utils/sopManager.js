const { ClaudeAI } = require('./claude');
const fs = require('fs');
const path = require('path');

class SOPManager {
  constructor() {
    this.sopDir = path.join(__dirname, '../sops');
    if (!fs.existsSync(this.sopDir)) fs.mkdirSync(this.sopDir, { recursive: true });
  }
  sanitizeFilename(topic) { return topic.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 50); }
  async getOrCreate(topic) {
    const filepath = path.join(this.sopDir, this.sanitizeFilename(topic) + '.md');
    if (fs.existsSync(filepath)) return '📁 **Existing SOP:**\n\n' + fs.readFileSync(filepath, 'utf-8');
    const claude = new ClaudeAI();
    const sop = await claude.generateSOP(topic);
    fs.writeFileSync(filepath, sop, 'utf-8');
    return '✨ **New SOP created:**\n\n' + sop;
  }
}

module.exports = { SOPManager };