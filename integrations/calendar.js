const { google } = require('googleapis');
class GoogleCalendar {
  constructor() {
    this.auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
    this.auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    this.calendar = google.calendar({ version:'v3', auth:this.auth });
  }
  async getTodayEvents() {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(),now.getMonth(),now.getDate());
      const end = new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59);
      const res = await this.calendar.events.list({ calendarId:'primary', timeMin:start.toISOString(), timeMax:end.toISOString(), singleEvents:true, orderBy:'startTime' });
      return (res.data.items||[]).map(e => ({ title:e.summary||'Untitled', time:e.start.dateTime?new Date(e.start.dateTime).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}):'All day' }));
    } catch(e) { console.error('Calendar:',e.message); return []; }
  }
}
module.exports = { GoogleCalendar };