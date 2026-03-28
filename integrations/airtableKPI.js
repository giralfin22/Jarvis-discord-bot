const { EmbedBuilder } = require('discord.js');

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

const CLIENTS = {
  strive: {
    name: 'Strive Online',
    emoji: '🟢',
    closer: 'Joao',
    baseId: 'app3DEGJjfiWl5DPA',
    monthTableId: 'tbl6PBHPFwrPnmVZu',
    trackingTableId: 'tblrK22WPQqccXBKq',
    model: 'closer',
    color: '#57F287'
  },
  simplifi: {
    name: 'Simplifi',
    emoji: '🔵',
    closer: 'Anthony / Matt',
    baseId: 'appylAzi80O5SMcgc',
    monthTableId: 'tbl6PBHPFwrPnmVZu',
    trackingTableId: 'tblrK22WPQqccXBKq',
    model: 'closer',
    color: '#5865F2'
  },
  mountleader: {
    name: 'MountLeader Media',
    emoji: '🟠',
    closer: 'Tilesh',
    baseId: 'appW9tyQ28gnVhmgR',
    monthTableId: 'tbl6PBHPFwrPnmVZu',
    trackingTableId: 'tblrK22WPQqccXBKq',
    model: 'closer',
    color: '#FF6B35'
  },
  instantai: {
    name: 'InstantAppointment AI',
    emoji: '🟡',
    closer: 'Younes',
    baseId: 'appWCpw3zjLkKYUtC',
    monthTableId: 'tblPgz88gllWlJs2a',
    trackingTableId: 'tblnsT9Um4j88Elme',
    model: 'setter',
    color: '#FEE75C'
  }
};

async function fetchAirtable(baseId, tableId, params) {
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
  if (params) Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  const r = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  if (!r.ok) throw new Error(`Airtable error: ${r.status}`);
  return r.json();
}

function getCurrentMonth() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${mm}-${now.getFullYear()}`;
}

function getPreviousMonth() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${mm}-${now.getFullYear()}`;
}

function getRating(showRate, closeRate, model) {
  if (model === 'setter') {
    if (closeRate >= 30) return '🔥 On Fire';
    if (closeRate >= 20) return '✅ Good';
    if (closeRate >= 10) return '⚠️ Needs Work';
    return '🔴 Critical';
  }
  if (showRate >= 60 && closeRate >= 35) return '🔥 On Fire';
  if (showRate >= 45 && closeRate >= 25) return '✅ Good';
  if (showRate >= 30 && closeRate >= 15) return '⚠️ Needs Work';
  return '🔴 Critical';
}

async function getCloserMonthData(client) {
  const currentMonth = getCurrentMonth();
  const prevMonth = getPreviousMonth();
  const data = await fetchAirtable(client.baseId, client.monthTableId, {
    'filterByFormula': `OR({Month} = '${currentMonth}', {Month} = '${prevMonth}')`,
    'maxRecords': 10
  });
  return data.records || [];
}

async function getRecentTrackingData(client) {
  const data = await fetchAirtable(client.baseId, client.trackingTableId, {
    'sort[0][field]': 'Date',
    'sort[0][direction]': 'desc',
    'maxRecords': 14
  });
  return data.records || [];
}

async function buildCloserEmbed(clientKey) {
  const client = CLIENTS[clientKey];
  try {
    const [monthRecords, trackingRecords] = await Promise.all([
      getCloserMonthData(client),
      getRecentTrackingData(client)
    ]);

    const currentMonth = getCurrentMonth();
    const currentRec = monthRecords.find(r => r.fields.Month === currentMonth);
    const fields = currentRec ? currentRec.fields : {};

    const booked = fields['Calls Booked'] || fields['Calls Booked Caden'] || fields['Calls Booked ROB'] || 0;
    const taken = fields['Calls Taken'] || fields['Calls Taken Caden'] || fields['Calls Taken ROB'] || 0;
    const closed = fields['Calls Closed'] || fields['Calls Closed Caden'] || fields['Calls Closed ROB'] || 0;
    const cashNew = fields['New Cash Collected'] || fields['Cash Collected'] || fields['Cash Collected Caden'] || fields['Cash Collected ROB'] || 0;
    const cashInstall = fields['Cash Collected Instalments'] || fields['Cash Collected Instalments Caden'] || fields['Cash Collected Instalments ROB'] || 0;
    const cashTotal = fields['Total Cash Collected'] || (cashNew + cashInstall) || 0;
    const cashContracted = fields['Cash Contracted'] || fields['Cash Contracted Caden'] || fields['Cash Contracted ROB'] || 0;

    const showRate = taken > 0 ? Math.round((taken / booked) * 100) : 0;
    const closeRate = taken > 0 ? Math.round((closed / taken) * 100) : 0;
    const rating = getRating(showRate, closeRate, 'closer');

    const last7 = trackingRecords.slice(0, 7);
    const recentBooked = last7.reduce((s, r) => s + (r.fields['Calls Booked'] || 0), 0);
    const recentTaken = last7.reduce((s, r) => s + (r.fields['Calls Taken'] || 0), 0);
    const recentClosed = last7.reduce((s, r) => s + (r.fields['Calls Closed'] || 0), 0);
    const recentCash = last7.reduce((s, r) => s + (r.fields['Cash Collected'] || r.fields['New Cash Collected'] || 0), 0);

    const embed = new EmbedBuilder()
      .setTitle(`${client.emoji} ${client.name} — Weekly KPI Report`)
      .setColor(client.color)
      .setDescription(`**Closer:** ${client.closer} | **Month:** ${currentMonth} | ${rating}`)
      .addFields(
        { name: '📅 THIS MONTH (MTD)', value: [
          `Booked: **${booked}** | Taken: **${taken}** | Show Rate: **${showRate}%**`,
          `Closed: **${closed}** | Close Rate: **${closeRate}%**`,
          `💰 Cash Collected: **$${Number(cashNew).toLocaleString()}** new + **$${Number(cashInstall).toLocaleString()}** installs = **$${Number(cashTotal).toLocaleString()}**`,
          `📝 Cash Contracted: **$${Number(cashContracted).toLocaleString()}**`
        ].join('\n'), inline: false },
        { name: '📊 LAST 7 DAYS', value: [
          `Booked: **${recentBooked}** | Taken: **${recentTaken}**`,
          `Closed: **${recentClosed}** | Cash: **$${Number(recentCash).toLocaleString()}**`
        ].join('\n'), inline: false }
      )
      .setFooter({ text: `Jarvis KPI Report | Pulled from Airtable | ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` })
      .setTimestamp();

    return embed;
  } catch(e) {
    console.error(`KPI error for ${client.name}:`, e.message);
    return new EmbedBuilder()
      .setTitle(`${client.emoji} ${client.name} — KPI Report`)
      .setColor('#ED4245')
      .setDescription(`Error fetching data: ${e.message}`)
      .setTimestamp();
  }
}

async function buildSetterEmbed(clientKey) {
  const client = CLIENTS[clientKey];
  try {
    const currentMonth = getCurrentMonth();
    const trackingRecords = await getRecentTrackingData(client);

    const last7 = trackingRecords.slice(0, 7);
    const smsSent = last7.reduce((s, r) => s + (r.fields['Total Sms Sent'] || 0), 0);
    const newConvos = last7.reduce((s, r) => s + (r.fields['New Convos'] || 0), 0);
    const followUps = last7.reduce((s, r) => s + (r.fields['Follow-Up Convos'] || 0), 0);
    const closed = last7.reduce((s, r) => s + (r.fields['Calls Closed'] || 0), 0);
    const dials = last7.reduce((s, r) => s + (r.fields['Dials Made'] || 0), 0);

    const convRate = smsSent > 0 ? ((newConvos / smsSent) * 100).toFixed(1) : 0;
    const closeRate = newConvos > 0 ? ((closed / newConvos) * 100).toFixed(1) : 0;
    const rating = getRating(0, Number(closeRate), 'setter');

    const embed = new EmbedBuilder()
      .setTitle(`${client.emoji} ${client.name} — Weekly KPI Report`)
      .setColor(client.color)
      .setDescription(`**Setter:** ${client.closer} | **Month:** ${currentMonth} | ${rating}`)
      .addFields(
        { name: '📊 LAST 7 DAYS (Setter Activity)', value: [
          `📱 SMS Sent: **${smsSent}** | 💬 New Convos: **${newConvos}** (${convRate}% conv rate)`,
          `🔄 Follow-Ups: **${followUps}** | 📞 Dials: **${dials}**`,
          `✅ Calls Closed: **${closed}** (${closeRate}% of convos → close)`
        ].join('\n'), inline: false }
      )
      .setFooter({ text: `Jarvis KPI Report | Pulled from Airtable | ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` })
      .setTimestamp();

    return embed;
  } catch(e) {
    console.error(`KPI error for ${client.name}:`, e.message);
    return new EmbedBuilder()
      .setTitle(`${client.emoji} ${client.name} — KPI Report`)
      .setColor('#ED4245')
      .setDescription(`Error fetching data: ${e.message}`)
      .setTimestamp();
  }
}

async function postWeeklyKPIs(client) {
  const KPI_CHANNEL_ID = '1487223466741731510';
  try {
    const ch = client.channels.cache.get(KPI_CHANNEL_ID);
    if (!ch) { console.log('kpi-tracker channel not found'); return; }
    await ch.send({ content: `📊 **WEEKLY KPI REPORT** — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` });
    const clientKeys = ['strive', 'simplifi', 'mountleader', 'instantai'];
    for (const key of clientKeys) {
      const c = CLIENTS[key];
      const embed = c.model === 'setter' ? await buildSetterEmbed(key) : await buildCloserEmbed(key);
      await ch.send({ embeds: [embed] });
      await new Promise(r => setTimeout(r, 800));
    }
    console.log('Weekly KPI reports posted');
  } catch(e) {
    console.error('KPI post error:', e.message);
  }
}

async function postSingleKPI(discordClient, clientKey) {
  const KPI_CHANNEL_ID = '1487223466741731510';
  const client = CLIENTS[clientKey];
  try {
    const ch = discordClient.channels.cache.get(KPI_CHANNEL_ID);
    if (!ch) return;
    const embed = client.model === 'setter' ? await buildSetterEmbed(clientKey) : await buildCloserEmbed(clientKey);
    await ch.send({ embeds: [embed] });
  } catch(e) {
    console.error(`Single KPI error:`, e.message);
  }
}

module.exports = { postWeeklyKPIs, postSingleKPI, CLIENTS };
