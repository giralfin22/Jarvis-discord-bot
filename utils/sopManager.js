const { ClaudeAI } = require('./claude');
const fs = require('fs'); const path = require('path');
class SOPManager {
  constructor() { this.sopDir = path.join(__dirname,'../sops'); if(!fs.existsSync(this.sopDir)) fs.mkdirSync(this.sopDir,{recursive:true}); }
  sanitizeFilename(t) { return t.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,50); }
  async getOrCreate(topic) {
    const fp = path.join(this.sopDir,this.sanitizeFilename(topic)+'.md');
    if(fs.existsSync(fp)) return '📁 **Existing SOP:**\n\n'+fs.readFileSync(fp,'utf-8');
    const claude = new ClaudeAI(); const sop = await claude.generateSOP(topic);
    fs.writeFileSync(fp,sop,'utf-8'); return '✨ **New SOP created:**\n\n'+sop;
  }
}
module.exports = { SOPManager };