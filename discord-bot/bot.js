require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const commands = [
  new SlashCommandBuilder().setName('priorities').setDescription('📋 Show your top priorities for today'),
  new SlashCommandBuilder().setName('digest').setDescription('📊 Get a full digest of recent activity'),
  new SlashCommandBuilder()
    .setName('sop').setDescription('📖 Manage SOPs')
    .addSubcommand(s => s.setName('list').setDescription('List all SOPs'))
    .addSubcommand(s => s.setName('get').setDescription('Get a specific SOP').addStringOption(o => o.setName('topic').setDescription('SOP topic').setRequired(true)))
    .addSubcommand(s => s.setName('create').setDescription('Request a new SOP').addStringOption(o => o.setName('topic').setDescription('Topic').setRequired(true))),
  new SlashCommandBuilder()
    .setName('task').setDescription('✅ Manage tasks')
    .addSubcommand(s => s.setName('add').setDescription('Add task').addStringOption(o => o.setName('description').setDescription('Task').setRequired(true)).addStringOption(o => o.setName('priority').setDescription('Priority').addChoices({name:'🔴 High',value:'high'},{name:'🟡 Medium',value:'medium'},{name:'🟢 Low',value:'low'})))
    .addSubcommand(s => s.setName('list').setDescription('List tasks')),
  new SlashCommandBuilder()
    .setName('standup').setDescription('🌅 Post daily standup')
    .addStringOption(o => o.setName('yesterday').setDescription('Yesterday').setRequired(true))
    .addStringOption(o => o.setName('today').setDescription('Today').setRequired(true))
    .addStringOption(o => o.setName('blockers').setDescription('Blockers')),
  new SlashCommandBuilder()
    .setName('client').setDescription('👤 Client management')
    .addSubcommand(s => s.setName('update').setDescription('Log update').addStringOption(o => o.setName('name').setDescription('Client').setRequired(true)).addStringOption(o => o.setName('update').setDescription('Update').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List clients')),
];

const state = {
  tasks: [],
  clients: {},
  standups: [],
  sops: {
    'onboarding': { title: 'Client Onboarding SOP', steps: ['1. Send welcome email within 24h','2. Schedule kickoff call within 3 business days','3. Create client folder in Google Drive','4. Add to project management tool','5. Set up recurring check-ins','6. Share access to tools/dashboards'] },
    'daily-checklist': { title: 'Daily Operations Checklist', steps: ['1. Check client messages, respond within 2 hours','2. Review and update task board','3. Post standup by 9:30 AM','4. Block 2 hours for deep work','5. End-of-day: update notes, close completed tasks'] },
    'employee-onboarding': { title: 'Employee Onboarding SOP', steps: ['1. Send welcome email with first-week schedule','2. Set up all accounts (Slack, Discord, tools)','3. Schedule intro calls with each team member','4. Share company handbook and SOPs','5. Assign first training task with mentor','6. Week 1 review call with manager'] },
  },
};

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands.map(c => c.toJSON()) });
    console.log('✅ Slash commands registered!');
  } catch (err) { console.error('❌ Command registration error:', err); }
}

client.once('ready', async () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
  await registerCommands();
  scheduleDailyDigest();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    const handlers = { priorities: handlePriorities, digest: handleDigest, sop: handleSOP, task: handleTask, standup: handleStandup, client: handleClient };
    if (handlers[interaction.commandName]) await handlers[interaction.commandName](interaction);
  } catch (err) {
    console.error('Command error:', err);
    const method = interaction.deferred ? 'editReply' : 'reply';
    await interaction[method]({ content: '❌ Something went wrong. Try again.', ephemeral: true });
  }
});

async function handlePriorities(i) {
  const high = state.tasks.filter(t => t.priority === 'high' && !t.done);
  const med = state.tasks.filter(t => t.priority === 'medium' && !t.done);
  const e = new EmbedBuilder().setTitle('🎯 Your Top Priorities Today').setColor(0xFF4444).setTimestamp().setFooter({ text: 'Stay focused. One thing at a time.' });
  if (high.length) e.addFields({ name: '🔴 HIGH PRIORITY', value: high.map((t,n) => `${n+1}. ${t.description}`).join('\n') });
  if (med.length) e.addFields({ name: '🟡 MEDIUM PRIORITY', value: med.map((t,n) => `${n+1}. ${t.description}`).join('\n') });
  if (!high.length && !med.length) e.setDescription('✨ No urgent tasks! Add tasks with `/task add`');
  await i.reply({ embeds: [e] });
}

async function handleDigest(i) {
  await i.deferReply();
  const open = state.tasks.filter(t => !t.done);
  const e = new EmbedBuilder().setTitle('📊 Business Digest').setColor(0x5865F2).setTimestamp()
    .addFields(
      { name: '🔴 Urgent', value: `${open.filter(t=>t.priority==='high').length}`, inline: true },
      { name: '📋 Open Tasks', value: `${open.length}`, inline: true },
      { name: '👤 Clients', value: `${Object.keys(state.clients).length}`, inline: true },
      { name: '🌅 Standups', value: `${state.standups.filter(s=>isToday(s.timestamp)).length} today`, inline: true },
    );
  if (open.length) e.addFields({ name: 'Top Tasks', value: open.slice(0,5).map(t=>`${t.priority==='high'?'🔴':t.priority==='medium'?'🟡':'🟢'} ${t.description}`).join('\n') });
  await i.editReply({ embeds: [e] });
}

async function handleSOP(i) {
  const sub = i.options.getSubcommand();
  if (sub === 'list') {
    const e = new EmbedBuilder().setTitle('📖 Available SOPs').setColor(0x57F287)
      .setDescription(Object.entries(state.sops).map(([k,s])=>`• \`${k}\` — ${s.title}`).join('\n') || 'No SOPs yet.')
      .setFooter({ text: 'Use /sop get <topic> to view details' });
    await i.reply({ embeds: [e] });
  } else if (sub === 'get') {
    const topic = i.options.getString('topic').toLowerCase();
    const sop = state.sops[topic];
    if (!sop) { await i.reply({ content: `❌ No SOP for \`${topic}\`. Try \`/sop list\`.`, ephemeral: true }); return; }
    await i.reply({ embeds: [new EmbedBuilder().setTitle(`📖 ${sop.title}`).setColor(0x57F287).setDescription(sop.steps.join('\n'))] });
  } else {
    const topic = i.options.getString('topic');
    await i.reply({ embeds: [new EmbedBuilder().setTitle('✅ SOP Request Logged').setColor(0xFEE75C).setDescription(`SOP for **"${topic}"** queued. Add it to \`state.sops\` in \`bot.js\`.`)] });
  }
}

async function handleTask(i) {
  const sub = i.options.getSubcommand();
  if (sub === 'add') {
    const desc = i.options.getString('description');
    const pri = i.options.getString('priority') || 'medium';
    state.tasks.push({ id: Date.now(), description: desc, priority: pri, done: false, createdAt: new Date(), user: i.user.username });
    const icons = {high:'🔴',medium:'🟡',low:'🟢'}, colors = {high:0xFF4444,medium:0xFEE75C,low:0x57F287};
    await i.reply({ embeds: [new EmbedBuilder().setTitle(`${icons[pri]} Task Added`).setColor(colors[pri]).setDescription(`**${desc}**`).addFields({name:'Priority',value:pri.toUpperCase(),inline:true},{name:'By',value:i.user.username,inline:true}).setTimestamp()] });
  } else {
    const open = state.tasks.filter(t => !t.done);
    if (!open.length) { await i.reply({ content: '✨ No open tasks!', ephemeral: true }); return; }
    const g = {high:[],medium:[],low:[]};
    open.forEach(t => g[t.priority].push(t));
    const e = new EmbedBuilder().setTitle('✅ Open Tasks').setColor(0x5865F2).setTimestamp();
    if (g.high.length) e.addFields({name:'🔴 High',value:g.high.map(t=>`• ${t.description}`).join('\n')});
    if (g.medium.length) e.addFields({name:'🟡 Medium',value:g.medium.map(t=>`• ${t.description}`).join('\n')});
    if (g.low.length) e.addFields({name:'🟢 Low',value:g.low.map(t=>`• ${t.description}`).join('\n')});
    await i.reply({ embeds: [e] });
  }
}

async function handleStandup(i) {
  state.standups.push({ user: i.user.username, yesterday: i.options.getString('yesterday'), today: i.options.getString('today'), blockers: i.options.getString('blockers')||'None 🎉', timestamp: new Date() });
  await i.reply({ embeds: [new EmbedBuilder().setTitle(`🌅 Standup — ${i.user.username}`).setColor(0xEB459E)
    .addFields({name:'✅ Yesterday',value:i.options.getString('yesterday')},{name:'🎯 Today',value:i.options.getString('today')},{name:'🚧 Blockers',value:i.options.getString('blockers')||'None 🎉'}).setTimestamp()] });
}

async function handleClient(i) {
  const sub = i.options.getSubcommand();
  if (sub === 'update') {
    const name = i.options.getString('name'), update = i.options.getString('update');
    if (!state.clients[name]) state.clients[name] = { updates: [] };
    state.clients[name].updates.push({ text: update, timestamp: new Date(), by: i.user.username });
    await i.reply({ embeds: [new EmbedBuilder().setTitle(`👤 Client Update — ${name}`).setColor(0x5865F2).setDescription(update).addFields({name:'By',value:i.user.username,inline:true}).setTimestamp()] });
  } else {
    const list = Object.entries(state.clients).map(([n,d])=>`• **${n}** — ${d.updates.length} update(s)`).join('\n');
    await i.reply({ embeds: [new EmbedBuilder().setTitle('👤 Active Clients').setColor(0x5865F2).setDescription(list||'No clients yet. Use `/client update` to add one.')] });
  }
}

function scheduleDailyDigest() {
  const next8am = new Date(); next8am.setHours(8,0,0,0);
  if (next8am <= new Date()) next8am.setDate(next8am.getDate()+1);
  setTimeout(() => { sendDailyDigest(); setInterval(sendDailyDigest, 86400000); }, next8am - new Date());
  console.log(`⏰ Daily digest at ${next8am.toLocaleTimeString()}`);
}

async function sendDailyDigest() {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;
  const channel = guild.channels.cache.find(c => c.name==='general'||c.name==='daily-digest');
  if (!channel) return;
  const open = state.tasks.filter(t=>!t.done), high = open.filter(t=>t.priority==='high');
  await channel.send({ embeds: [new EmbedBuilder().setTitle('☀️ Good Morning! Daily Digest').setColor(0xFEE75C)
    .setDescription("Here's what needs your attention today:")
    .addFields({name:'🔴 Urgent',value:high.length?high.map(t=>`• ${t.description}`).join('\n'):'None — great job!'},{name:'📋 Open',value:`${open.length}`,inline:true},{name:'👤 Clients',value:`${Object.keys(state.clients).length}`,inline:true})
    .setTimestamp().setFooter({text:'Use /priorities for your full list'})] });
}

function isToday(d) {
  const t = new Date();
  return d.getDate()===t.getDate()&&d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear();
}

client.login(process.env.DISCORD_TOKEN);
