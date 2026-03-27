const { WebClient } = require('@slack/web-api');
class SlackIntegration {
  constructor() { this.client = new WebClient(process.env.SLACK_BOT_TOKEN); this.urgent = ['urgent','asap','emergency','critical','blocked','down']; }
  async getDailySummary() {
    try {
      const r = await this.client.conversations.list({ types:'public_channel,private_channel', limit:20 });
      const since = Math.floor((Date.now()-86400000)/1000); const lines = [];
      for(const ch of r.channels.filter(c=>!c.is_archived).slice(0,5)) {
        try { const h = await this.client.conversations.history({channel:ch.id,oldest:String(since),limit:10}); if((h.messages||[]).length) lines.push('**#'+ch.name+'** - '+h.messages.length+' message(s)'); } catch(e) {}
      }
      return lines.join('\n')||'No significant activity.';
    } catch(e) { return 'Unable to fetch.'; }
  }
  async getUrgentMessages() {
    try {
      const r = await this.client.conversations.list({types:'public_channel,private_channel',limit:20});
      const since = Math.floor((Date.now()-1800000)/1000); const msgs = [];
      for(const ch of r.channels.filter(c=>!c.is_archived).slice(0,10)) {
        try {
          const h = await this.client.conversations.history({channel:ch.id,oldest:String(since),limit:20});
          for(const m of (h.messages||[])) {
            if(m.bot_id) continue;
            if(this.urgent.some(k=>(m.text||'').toLowerCase().includes(k))) {
              let user='Unknown'; try{const u=await this.client.users.info({user:m.user});user=u.user?.real_name||'Unknown';}catch(_){}
              msgs.push({text:m.text,user,channel:ch.name});
            }
          }
        } catch(e) {}
      }
      return msgs;
    } catch(e) { return []; }
  }
}
module.exports = { SlackIntegration };