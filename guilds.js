function createGuildIcon(icon, name) {
  const iconEl = document.createElement('div');
  iconEl.className = 'guild-icon';

  if (icon) {
    if (typeof icon === 'string' && (icon.startsWith('http') || icon.startsWith('data:'))) {
      const img = document.createElement('img');
      img.src = icon;
      img.alt = name || '';
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
      iconEl.appendChild(img);
    } else if (typeof icon === 'string') {
      iconEl.innerHTML = icon;
    } else {
      iconEl.appendChild(icon);
    }
  } else if (name) {
    const initials = document.createElement('span');
    initials.textContent = name.substring(0, 2).toUpperCase();
    initials.style.cssText = 'font-weight: 600; font-size: 18px; color: #fff;';
    iconEl.appendChild(initials);
  }

  return iconEl;
}

function addUnreadDot(item) {
  const icon = item.querySelector('.guild-icon');
  if (icon) icon.style.position = 'relative';
  if (!item.querySelector('.guild-unread-dot')) {
    item.appendChild(Object.assign(document.createElement('div'), { className: 'guild-unread-dot' }));
  }
}

function addPingIndicator(item) {
  const icon = item.querySelector('.guild-icon');
  if (icon) icon.style.position = 'relative';
  if (!item.querySelector('.guild-ping')) {
    item.appendChild(Object.assign(document.createElement('div'), { className: 'guild-ping' }));
  }
}

function setConnectionStatus(item, status) {
  item.classList.remove('server-error', 'server-disconnected', 'server-connecting');
  if (status === 'error') item.classList.add('server-disconnected');
  else if (status === 'connecting') item.classList.add('server-connecting');
}

function renderGuildSidebar() {
  const guildList = document.getElementById('guild-list');
  const homeGuild = guildList.querySelector('.home-guild');
  guildList.innerHTML = '';

  if (homeGuild) {
    homeGuild.classList.toggle('active', state.serverUrl === 'dms.mistium.com');
    const dmConn = wsConnections['dms.mistium.com'];
    setConnectionStatus(homeGuild, dmConn?.status);
    if (dmConn?.status === 'connecting') homeGuild.querySelector('.guild-icon').style.position = 'relative';

    const hasUnread = state.unreadCountsByServer['dms.mistium.com'] > 0 || (typeof hasServerUnread === 'function' && hasServerUnread('dms.mistium.com'));
    const existingDot = homeGuild.querySelector('.guild-unread-dot');
    const existingPing = homeGuild.querySelector('.guild-ping');

    if (hasUnread && !existingDot) addUnreadDot(homeGuild);
    else if (!hasUnread && existingDot) existingDot.remove();

    if (state.serverPingsByServer['dms.mistium.com'] > 0 && !existingPing) addPingIndicator(homeGuild);
    else if (!(state.serverPingsByServer['dms.mistium.com'] > 0) && existingPing) existingPing.remove();

    guildList.appendChild(homeGuild);
  }

  if (state.dmServers?.length > 0) {
    state.dmServers.forEach(dmServer => {
      const item = document.createElement('div');
      item.className = 'guild-item dm-server';
      item.dataset.channel = dmServer.channel;
      item.title = dmServer.name;
      if (state.serverUrl === 'dms.mistium.com' && state.currentChannel?.name === dmServer.channel) item.classList.add('active');

      item.appendChild(createGuildIcon(`https://avatars.rotur.dev/${dmServer.username}`, dmServer.name));
      item.appendChild(Object.assign(document.createElement('div'), { className: 'guild-pill' }));

      const channelKey = `dms.mistium.com:${dmServer.channel}`;
      const channels = state.channelsByServer['dms.mistium.com'] || [];
      const dmChannel = channels.find(c => c.name === dmServer.channel);
      const hasUnread = state.unreadByChannel[channelKey] > 0 || (dmChannel && typeof isChannelUnread === 'function' && isChannelUnread(dmChannel, 'dms.mistium.com'));
      if (hasUnread) addUnreadDot(item);

      item.onclick = () => {
        state.dmServers = state.dmServers.filter(dm => dm.channel !== dmServer.channel);
        localStorage.setItem('originchats_dm_servers', JSON.stringify(state.dmServers));
        renderGuildSidebar();
        if (state.serverUrl !== 'dms.mistium.com') switchServer('dms.mistium.com');
        setTimeout(() => {
          const ch = (state.channelsByServer['dms.mistium.com'] || [])
            .find(c => c.name === dmServer.channel);
          if (ch) selectChannel(ch);
          else {
            state.pendingMessageFetchesByChannel[`dms.mistium.com:${dmServer.channel}`] = true;
            wsSend({ cmd: 'messages_get', channel: dmServer.channel }, 'dms.mistium.com');
            const temp = { name: dmServer.channel, display_name: dmServer.name, type: 'text', icon: `https://avatars.rotur.dev/${dmServer.username}` };
            if (!state.channelsByServer['dms.mistium.com']) state.channelsByServer['dms.mistium.com'] = [];
            if (!state.channelsByServer['dms.mistium.com'].find(c => c.name === dmServer.channel)) state.channelsByServer['dms.mistium.com'].push(temp);
            selectChannel(temp);
          }
        }, 100);
      };
      item.addEventListener('contextmenu', e => { e.preventDefault(); if (typeof showDMContextMenu === 'function') showDMContextMenu(e, dmServer); });
      guildList.appendChild(item);
    });
  }

  guildList.appendChild(Object.assign(document.createElement('div'), { className: 'guild-divider' }));

  state.servers.forEach((server, idx) => {
    const item = document.createElement('div');
    item.className = 'guild-item';
    if (server.url === state.serverUrl) item.classList.add('active');
    item.dataset.url = server.url;
    item.dataset.index = idx;
    item.draggable = true;

    item.appendChild(createGuildIcon(server.icon, server.name));
    item.appendChild(Object.assign(document.createElement('div'), { className: 'guild-pill' }));

    const conn = wsConnections[server.url];
    setConnectionStatus(item, conn?.status);
    item.title = conn?.status === 'error' ? `${server.name} (Not responding - click to reconnect)` : conn?.status === 'connecting' ? `${server.name} (Connecting...)` : server.name;
    if (conn?.status === 'connecting') item.querySelector('.guild-icon').style.position = 'relative';

    if (state.unreadCountsByServer[server.url] > 0 || (typeof hasServerUnread === 'function' && hasServerUnread(server.url))) addUnreadDot(item);
    if (state.serverPingsByServer[server.url] > 0) addPingIndicator(item);

    item.addEventListener('dragstart', e => { item.classList.add('dragging'); e.dataTransfer.setData('text/plain', server.url); e.dataTransfer.effectAllowed = 'move'; });
    item.addEventListener('dragend', () => { item.classList.remove('dragging'); document.querySelectorAll('.guild-item.drag-over').forEach(el => el.classList.remove('drag-over')); });
    item.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; item.classList.add('drag-over'); });
    item.addEventListener('drop', e => { e.preventDefault(); const u = e.dataTransfer.getData('text/plain'); if (u !== server.url) reorderServers(u, server.url); item.classList.remove('drag-over'); });
    item.onclick = e => { if (e.detail !== 0 && !e.type.includes('drag')) handleServerClick(server.url); };
    item.addEventListener('contextmenu', e => { e.preventDefault(); showGuildContextMenu(e, server); });

    guildList.appendChild(item);
  });

  guildList.appendChild(Object.assign(document.createElement('div'), { className: 'guild-divider' }));

  const addBtn = document.createElement('div');
  addBtn.className = 'guild-item add-guild';
  addBtn.onclick = addNewServer;
  addBtn.title = 'Add a Server';
  addBtn.appendChild(createGuildIcon('<i data-lucide="plus"></i>'));
  guildList.appendChild(addBtn);

  const discBtn = document.createElement('div');
  discBtn.className = 'guild-item discover-guild';
  discBtn.onclick = openDiscoveryModal;
  discBtn.title = 'Discover Servers';
  discBtn.appendChild(createGuildIcon('<i data-lucide="compass"></i>'));
  guildList.appendChild(discBtn);

  if (window.lucide) window.lucide.createIcons({ root: guildList });
}

async function reorderServers(draggedUrl, targetUrl) {
  const draggedIndex = state.servers.findIndex(s => s.url === draggedUrl);
  const targetIndex = state.servers.findIndex(s => s.url === targetUrl);
  if (draggedIndex === -1 || targetIndex === -1) return;
  const [draggedServer] = state.servers.splice(draggedIndex, 1);
  state.servers.splice(targetIndex, 0, draggedServer);
  await saveServers();
  renderGuildSidebar();
}

function showGuildContextMenu(event, server) {
  contextMenu(event)
    .item('Mark as Read', () => markServerAsRead(server.url), 'check-circle')
    .sep()
    .item('Copy URL', () => navigator.clipboard.writeText(server.url), 'copy')
    .danger('Leave Server', () => leaveServer(server.url), 'log-out')
    .show();
}

async function leaveServer(url) {
  if (!confirm('Leave this server?')) return;
  state.leavingServers = state.leavingServers || {};
  state.leavingServers[url] = true;
  wsSend({ cmd: 'leave' }, url);
  state.servers = state.servers.filter(s => s.url !== url);
  await saveServers();
  closeWebSocket(url);
  ['channelsByServer', 'messagesByServer', 'pingsByServer', 'usersByServer', 'currentUserByServer'].forEach(k => delete state[k][url]);
  if (state.serverUrl === url) state.servers.length > 0 ? switchServer(state.servers[0].url) : Object.keys(wsConnections).forEach(closeWebSocket);
  renderGuildSidebar();
}

function markServerAsRead(serverUrl) {
  const channels = state.channelsByServer[serverUrl];
  if (!channels) return;
  if (!state.readTimesByServer[serverUrl]) state.readTimesByServer[serverUrl] = {};
  channels.forEach(c => { if (c.last_message) state.readTimesByServer[serverUrl][c.name] = c.last_message; });
  state.unreadCountsByServer[serverUrl] = 0;
  ['unreadReplies', 'unreadPings', 'unreadByChannel'].forEach(k => Object.keys(state[k]).filter(k => k.startsWith(`${serverUrl}:`)).forEach(k => delete state[k][k]));
  saveReadTimes();
  renderGuildSidebar();
  if (state.serverUrl === serverUrl) renderChannels();
}

async function handleServerClick(url) {
  const conn = wsConnections[url];
  const prevUrl = state.serverUrl;

  if (!conn || conn.status === 'error') {
    const el = document.querySelector(`.guild-item[data-url="${url}"]`);
    if (el) { el.classList.remove('server-disconnected'); el.classList.add('server-connecting'); }
    connectToServer(url);

    const start = Date.now();
    let connected = false;
    while (Date.now() - start < 5000) {
      const c = wsConnections[url];
      if (c?.status === 'connected') { connected = true; break; }
      if (c?.status === 'error') break;
      await new Promise(r => setTimeout(r, 100));
    }

    if (connected) switchServer(url);
    else { state.serverUrl = prevUrl; renderGuildSidebar(); showError('Failed to connect to server'); }
  } else {
    switchServer(url);
  }
}

async function showHome() {
  if (state.serverUrl === 'dms.mistium.com') return;
  const conn = wsConnections['dms.mistium.com'];
  if (!conn || conn.status === 'error') {
    const el = document.querySelector('.home-guild');
    if (el) { el.classList.remove('server-disconnected'); el.classList.add('server-connecting'); }
    connectToServer('dms.mistium.com');

    const start = Date.now();
    let connected = false;
    while (Date.now() - start < 5000) {
      const c = wsConnections['dms.mistium.com'];
      if (c?.status === 'connected') { connected = true; break; }
      if (c?.status === 'error') break;
      await new Promise(r => setTimeout(r, 100));
    }

    if (connected) switchServer('dms.mistium.com');
    else { renderGuildSidebar(); showError('Failed to connect to Direct Messages'); }
  } else {
    switchServer('dms.mistium.com');
  }
}

window.renderGuildSidebar = renderGuildSidebar;
window.reorderServers = reorderServers;
window.showGuildContextMenu = showGuildContextMenu;
window.leaveServer = leaveServer;
window.markServerAsRead = markServerAsRead;
window.handleServerClick = handleServerClick;
window.showHome = showHome;
window.createGuildIcon = createGuildIcon;
window.addUnreadDot = addUnreadDot;
window.addPingIndicator = addPingIndicator;
window.setConnectionStatus = setConnectionStatus;
