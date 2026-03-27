const { google } = require('googleapis');

class GoogleCalendar {
  constructor() {
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    this.auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  async getTodayEvents() {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const response = await this.calendar.events.list({
        calendarId: 'primary', timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(), singleEvents: true, orderBy: 'startTime',
      });
      return (response.data.items || []).map(event => ({
        title: event.summary || 'Untitled Event',
        time: event.start.dateTime ? new Date(event.start.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'All day',
        description: event.description || '', location: event.location || '',
      }));
    } catch (error) { console.error('Calendar error:', error.message); return []; }
  }
}

module.exports = { GoogleCalendar };
