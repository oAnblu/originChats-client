let serverSettingsState = {
    currentSection: 'overview',
    roles: [],
    channels: [],
    members: [],
    selectedMember: null,
    editingChannel: null,
    editingRole: null
};
window.serverSettingsState = serverSettingsState;

function openServerSettings() {
    closeMenu();
    const modal = document.getElementById('server-settings-modal');
    if (!modal) {
        console.error('Server settings modal not found');
        return;
    }
    modal.style.display = 'flex';

    const serverSettingsBtn = document.getElementById('server-settings-btn');
    const isOwner = state.currentUser?.roles?.includes('owner');
    if (serverSettingsBtn && state.serverUrl !== 'dms.mistium.com' && isOwner) {
        serverSettingsBtn.style.display = 'flex';
    }

    loadServerData();
    setupServerSettingsEventListeners();
}

function closeServerSettings() {
    const modal = document.getElementById('server-settings-modal');
    if (modal) {
        modal.style.display = 'none';
    }

    clearServerSettings();
}

function showServerSettingsSection(section) {
    serverSettingsState.currentSection = section;

    document.querySelectorAll('.server-nav-item').forEach(item => {
        if (item.dataset.section === section) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    document.querySelectorAll('.server-section').forEach(sec => {
        if (sec.id === `server-section-${section}`) {
            sec.classList.add('active');
        } else {
            sec.classList.remove('active');
        }
    });
}

async function loadServerData() {
    if (state.serverUrl === 'dms.mistium.com') {
        closeServerSettings();
        return;
    }

    loadServerOverview();
    await loadRoles();
    await loadChannels();
    await loadMembers();
}

function loadServerOverview() {
    const serverName = document.getElementById('overview-server-name');
    const serverUrl = document.getElementById('overview-server-url');
    const userRole = document.getElementById('overview-user-role');
    const headerName = document.getElementById('server-settings-name');
    const headerUrl = document.getElementById('server-settings-url');
    const headerIcon = document.getElementById('server-settings-icon');

    const currentServer = state.servers.find(s => s.url === state.serverUrl);
    const displayName = (currentServer && currentServer.name) ? currentServer.name : (state.serverUrl || 'Server Settings');

    if (currentServer) {
        serverName.textContent = currentServer.name || '-';
    }

    serverUrl.textContent = state.serverUrl || '-';
    if (headerName) {
        headerName.textContent = displayName;
    }
    if (headerUrl) {
        headerUrl.textContent = state.serverUrl || '';
    }
    if (headerIcon) {
        headerIcon.innerHTML = '';
        if (currentServer && currentServer.icon) {
            const img = document.createElement('img');
            img.src = currentServer.icon;
            img.alt = displayName;
            headerIcon.appendChild(img);
        } else {
            headerIcon.textContent = displayName.charAt(0).toUpperCase();
        }
    }

    if (state.currentUser && state.currentUser.roles) {
        const roles = state.currentUser.roles;
        userRole.textContent = roles.length > 0 ? roles.join(', ') : '-';
        userRole.style.color = roles && roles[0] ? getRoleColor(roles[0]) : 'var(--text-dim, #a0a0a0)';
    } else {
        userRole.textContent = '-';
    }
}

async function loadRoles() {
    serverSettingsState.roles = [];

    wsSend({ cmd: 'roles_list' }, state.serverUrl);

    await new Promise(resolve => {
        let resolved = false;
        const checkRoles = setInterval(() => {
            if (serverSettingsState.roles.length > 0 || state.usersByServer[state.serverUrl]) {
                clearInterval(checkRoles);
                if (!resolved) { resolved = true; resolve(); }
            }
        }, 100);
        setTimeout(() => {
            clearInterval(checkRoles);
            if (!resolved) { resolved = true; resolve(); }
        }, 3000);
    });

    renderRoles();
}

function renderRoles() {
    const rolesList = document.getElementById('roles-list');
    if (!rolesList) return;

    if (serverSettingsState.roles.length === 0) {
        rolesList.innerHTML = '<div style="padding: 32px; text-align: center; color: var(--text-dim, #a0a0a0);">No roles found</div>';
        return;
    }

    rolesList.innerHTML = serverSettingsState.roles.map(role => {
        const isSystemRole = ['owner', 'admin', 'user'].includes(role.name);
        const escapedName = escapeHtml(role.name);
        const escapedDesc = escapeHtml(role.description || 'No description');
        const escapedColor = escapeHtml(role.color || '#5865F2');
        return `
  <div class="role-item" data-role="${escapedName}">
  <div class="role-color-preview" style="background: ${escapedColor}"></div>
  <div class="role-info">
  <div class="role-name" style="color: ${escapedColor}">${escapedName}</div>
  <div class="role-description">${escapedDesc}</div>
  </div>
  <div class="role-actions">
  ${!isSystemRole ? `
  <button class="role-action-btn" onclick="openEditRoleModal('${escapedName}')" title="Edit Role">
  <i data-lucide="edit-2"></i>
  </button>
  <button class="role-action-btn delete" onclick="deleteRole('${escapedName}')" title="Delete Role">
  <i data-lucide="trash-2"></i>
  </button>
  ` : `
  <span style="font-size: 12px; color: var(--text-dim, #a0a0a0);">System Role</span>
  `}
  </div>
  </div>
  `;
    }).join('');

    if (window.lucide) {
        window.lucide.createIcons({ root: rolesList });
    }
}

async function loadChannels() {
    serverSettingsState.channels = state.channels || [];
    renderManagementChannels();
}

function renderManagementChannels() {
    const channelsList = document.getElementById('channels-management-list');
    if (!channelsList) return;

    if (serverSettingsState.channels.length === 0) {
        channelsList.innerHTML = '<div style="padding: 32px; text-align: center; color: var(--text-dim, #a0a0a0);">No channels found</div>';
        return;
    }

    channelsList.innerHTML = serverSettingsState.channels.map((channel, index) => {
        let icon = 'hash';
        if (channel.type === 'voice') icon = 'mic';
        if (channel.type === 'separator') icon = 'minus';
        const escapedName = escapeHtml(channel.name);
        const escapedDisplayName = escapeHtml(channel.display_name || channel.name);
        return `
  <div class="channel-management-item" data-channel="${escapedName}">
  <div class="channel-type-icon">
  <i data-lucide="${icon}"></i>
  </div>
  <div class="channel-info">
  <div class="channel-name">${escapedDisplayName} ${channel.type === 'separator' ? '(separator)' : ''}</div>
  <div class="channel-type">${escapeHtml(channel.type)}</div>
  </div>
  <div class="channel-management-actions">
  ${channel.type !== 'separator' ? `
  <button class="channel-action-btn" onclick="moveChannelUp('${escapedName}', ${index})" title="Move Up" ${index === 0 ? 'disabled' : ''}>
  <i data-lucide="chevron-up"></i>
  </button>
  <button class="channel-action-btn" onclick="moveChannelDown('${escapedName}', ${index})" title="Move Down" ${index === serverSettingsState.channels.length - 1 ? 'disabled' : ''}>
  <i data-lucide="chevron-down"></i>
  </button>
  <button class="channel-action-btn" onclick="openEditChannelModal('${escapedName}')" title="Edit Channel">
  <i data-lucide="edit-2"></i>
  </button>
  <button class="channel-action-btn delete" onclick="deleteChannel('${escapedName}')" title="Delete Channel">
  <i data-lucide="trash-2"></i>
  </button>
  ` : `
  <button class="channel-action-btn" onclick="openEditChannelModal('${escapedName}')" title="Edit Separator">
  <i data-lucide="edit-2"></i>
  </button>
  <button class="channel-action-btn delete" onclick="deleteChannel('${escapedName}')" title="Delete Separator">
  <i data-lucide="trash-2"></i>
  </button>
  `}
  </div>
  </div>
  `;
    }).join('');

    if (window.lucide) {
        window.lucide.createIcons({ root: channelsList });
    }
}

async function loadMembers() {
    serverSettingsState.members = Object.values(state.users || {});
    renderManagementMembers();
}

function renderManagementMembers(filter = '') {
    const membersList = document.getElementById('members-list-container');
    if (!membersList) return;

    let filteredMembers = serverSettingsState.members;

    if (filter && typeof filter === 'string') {
        const lowerFilter = filter.toLowerCase();
        filteredMembers = serverSettingsState.members.filter(member =>
            member.username.toLowerCase().includes(lowerFilter)
        );
    }

    if (filteredMembers.length === 0) {
        membersList.innerHTML = '<div style="padding: 32px; text-align: center; color: var(--text-dim, #a0a0a0);">No members found</div>';
        return;
    }

    const sortedMembers = filteredMembers.sort((a, b) => {
        const aRoles = a.roles || [];
        const bRoles = b.roles || [];

        if (aRoles.includes('owner') && !bRoles.includes('owner')) return -1;
        if (!aRoles.includes('owner') && bRoles.includes('owner')) return 1;
        if (aRoles.includes('admin') && !bRoles.includes('admin')) return -1;
        if (!aRoles.includes('admin') && bRoles.includes('admin')) return 1;

        return a.username.localeCompare(b.username);
    });

    membersList.innerHTML = sortedMembers.map(member => {
        const escapedUsername = escapeHtml(member.username);
        return `
  <div class="member-row" data-member="${escapedUsername}">
  <div class="member-avatar">
  <img src="${getAvatarUrl(member.username)}" alt="${escapedUsername}">
  </div>
  <div class="member-details">
  <div class="member-name">${escapedUsername}</div>
  <div class="member-roles-display">
  ${(member.roles || []).slice(0, 3).map(role => `
  <span class="member-role-badge" style="background: ${escapeHtml(getRoleColor(role))}">${escapeHtml(role)}</span>
  `).join('')}
  ${(member.roles || []).length > 3 ? `<span class="member-role-badge">+${member.roles.length - 3}</span>` : ''}
  </div>
  </div>
  <div class="member-actions">
  <button class="member-action-btn" onclick="openMemberRolesModal('${escapedUsername}')" title="Manage Roles">
  <i data-lucide="settings"></i>
  </button>
  </div>
  </div>
  `;
    }).join('');

    if (window.lucide) {
        window.lucide.createIcons({ root: membersList });
    }
}

function setupServerSettingsEventListeners() {
    const navItems = document.querySelectorAll('.server-nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            showServerSettingsSection(item.dataset.section);
        });
    });

    const serverSettingsBtn = document.getElementById('server-settings-btn');
    const isOwner = state.currentUser?.roles?.includes('owner');
    if (serverSettingsBtn && isOwner) {
        serverSettingsBtn.style.display = 'flex';
    }

    const channelForm = document.getElementById('channel-form');
    if (channelForm) {
        channelForm.addEventListener('submit', handleChannelSubmit);
    }

    const roleForm = document.getElementById('role-form');
    if (roleForm) {
        roleForm.addEventListener('submit', handleRoleSubmit);
    }

    const membersSearchInput = document.getElementById('members-search-input');
    if (membersSearchInput) {
        membersSearchInput.addEventListener('input', (e) => {
            renderManagementMembers(e.target.value);
        });
    }

    const roleColorInput = document.getElementById('role-color');
    const roleColorText = document.getElementById('role-color-text');
    if (roleColorInput && roleColorText) {
        roleColorInput.addEventListener('input', (e) => {
            roleColorText.value = e.target.value;
        });
        roleColorText.addEventListener('input', (e) => {
            const hex = e.target.value.match(/^#([0-9A-F]{3}){1,2}$/i);
            if (hex) {
                roleColorInput.value = e.target.value;
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const serverSettingsModal = document.getElementById('server-settings-modal');
            if (serverSettingsModal && serverSettingsModal.style.display !== 'none') {
                closeServerSettings();
            }
        }
    });

    const closeBtn = document.querySelector('.modal-close-btn-wrapper');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

function getRoleColor(roleName) {
    if (!serverSettingsState.roles) return '#5865F2';
    const role = serverSettingsState.roles.find(r => r.name === roleName);
    return role ? role.color : '#5865F2';
}

function getAvatarUrl(username) {
    const avatarData = state._avatarCache[username];
    if (avatarData) return avatarData;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&size=80`;
}

/* Channel Management */
function openCreateChannelModal() {
    const modal = document.getElementById('create-channel-modal');
    modal.classList.add('active');
    modal.style.display = 'flex';

    serverSettingsState.editingChannel = null;

    document.getElementById('channel-modal-title').textContent = 'Create Channel';
    document.getElementById('channel-current-name').value = '';
    document.getElementById('channel-type').value = 'text';
    document.getElementById('channel-name').value = '';
    document.getElementById('channel-description').value = '';
    document.getElementById('channel-wallpaper').value = '';
    document.getElementById('channel-size').value = '10';
    document.getElementById('channel-submit-btn').textContent = 'Create';

    updateChannelTypeFields();
    document.getElementById('channel-form').reset();
}

function openEditChannelModal(channelName) {
    const modal = document.getElementById('create-channel-modal');
    modal.classList.add('active');
    modal.style.display = 'flex';

    const channel = serverSettingsState.channels.find(c => c.name === channelName);
    if (!channel) return;

    serverSettingsState.editingChannel = channel;

    document.getElementById('channel-modal-title').textContent = 'Edit Channel';
    document.getElementById('channel-current-name').value = channelName;
    document.getElementById('channel-type').value = channel.type || 'text';
    document.getElementById('channel-name').value = (channel.display_name || channel.name).replace(/^#/, '').replace(/^(separator)/, '');
    document.getElementById('channel-description').value = channel.description || '';
    document.getElementById('channel-wallpaper').value = channel.wallpaper || '';
    document.getElementById('channel-size').value = channel.size || '10';
    document.getElementById('channel-submit-btn').textContent = 'Save';

    updateChannelTypeFields();
}

function closeCreateChannelModal() {
    const modal = document.getElementById('create-channel-modal');
    modal.classList.remove('active');
    modal.style.display = 'none';
    serverSettingsState.editingChannel = null;
}

function updateChannelTypeFields() {
    const type = document.getElementById('channel-type').value;
    const nameGroup = document.getElementById('channel-name-group');
    const descriptionGroup = document.getElementById('channel-description-group');
    const wallpaperGroup = document.getElementById('channel-wallpaper-group');
    const sizeGroup = document.getElementById('channel-size-group');

    if (type === 'separator') {
        nameGroup.style.display = 'none';
        descriptionGroup.style.display = 'none';
        wallpaperGroup.style.display = 'none';
        sizeGroup.style.display = 'block';
    } else {
        nameGroup.style.display = 'block';
        descriptionGroup.style.display = 'block';
        wallpaperGroup.style.display = 'block';
        sizeGroup.style.display = 'none';
    }
}

function handleChannelSubmit(e) {
    e.preventDefault();

    const type = document.getElementById('channel-type').value;
    const currentName = document.getElementById('channel-current-name').value;
    const nameInput = document.getElementById('channel-name').value.trim();
    const description = document.getElementById('channel-description').value.trim();
    const wallpaper = document.getElementById('channel-wallpaper').value.trim();
    const size = parseInt(document.getElementById('channel-size').value) || 10;

    if (serverSettingsState.editingChannel) {
        const updates = {};

        if (type === 'separator') {
            if (size !== serverSettingsState.editingChannel.size) {
                updates.size = size;
            }
        } else {
            const newName = nameInput;
            if (newName && newName !== serverSettingsState.editingChannel.display_name && newName !== serverSettingsState.editingChannel.name) {
                updates.name = newName;
            }
            if (description !== (serverSettingsState.editingChannel.description || '')) {
                updates.description = description;
            }
            if (wallpaper !== (serverSettingsState.editingChannel.wallpaper || '')) {
                updates.wallpaper = wallpaper;
            }
        }

        if (Object.keys(updates).length > 0) {
            wsSend({
                cmd: 'channel_update',
                current_name: currentName,
                updates: updates
            }, state.serverUrl);
        }
    } else {
        const channelData = {
            cmd: 'channel_create',
            type: type
        };

        if (type === 'separator') {
            channelData.name = `separator${Date.now()}`;
            channelData.size = size;
        } else {
            channelData.name = nameInput;
            channelData.description = description;
            if (wallpaper) {
                channelData.wallpaper = wallpaper;
            }
        }

        wsSend(channelData, state.serverUrl);
    }

    closeCreateChannelModal();
}

function deleteChannel(channelName) {
    if (channelName.startsWith('separator')) {
        if (!confirm('Are you sure you want to delete this separator?')) return;
    } else {
        if (!confirm(`Are you sure you want to delete the channel #${channelName}? This action cannot be undone.`)) return;
    }

    wsSend({
        cmd: 'channel_delete',
        name: channelName
    }, state.serverUrl);
}

function moveChannelUp(channelName, currentIndex) {
    if (currentIndex <= 0) return;

    const newPosition = currentIndex - 1;
    wsSend({
        cmd: 'channel_move',
        name: channelName,
        position: newPosition
    }, state.serverUrl);
}

function moveChannelDown(channelName, currentIndex) {
    if (currentIndex >= serverSettingsState.channels.length - 1) return;

    const newPosition = currentIndex + 1;
    wsSend({
        cmd: 'channel_move',
        name: channelName,
        position: newPosition
    }, state.serverUrl);
}

/* Role Management */
function openCreateRoleModal() {
    const modal = document.getElementById('create-role-modal');
    modal.classList.add('active');
    modal.style.display = 'flex';

    serverSettingsState.editingRole = null;

    document.getElementById('role-modal-title').textContent = 'Create Role';
    document.getElementById('role-current-name').value = '';
    document.getElementById('role-name').value = '';
    document.getElementById('role-description').value = '';
    document.getElementById('role-color').value = '#5865F2';
    document.getElementById('role-color-text').value = '#5865F2';
    document.getElementById('role-submit-btn').textContent = 'Create';

    document.getElementById('role-form').reset();
}

function openEditRoleModal(roleName) {
    const modal = document.getElementById('create-role-modal');
    modal.classList.add('active');
    modal.style.display = 'flex';

    const role = serverSettingsState.roles.find(r => r.name === roleName);
    if (!role) return;

    serverSettingsState.editingRole = role;

    document.getElementById('role-modal-title').textContent = 'Edit Role';
    document.getElementById('role-current-name').value = roleName;
    document.getElementById('role-name').value = roleName;
    document.getElementById('role-name').disabled = true;
    document.getElementById('role-description').value = role.description || '';
    document.getElementById('role-color').value = role.color || '#5865F2';
    document.getElementById('role-color-text').value = role.color || '#5865F2';
    document.getElementById('role-submit-btn').textContent = 'Save';
}

function closeCreateRoleModal() {
    const modal = document.getElementById('create-role-modal');
    modal.classList.remove('active');
    modal.style.display = 'none';
    serverSettingsState.editingRole = null;

    document.getElementById('role-name').disabled = false;
}

function handleRoleSubmit(e) {
    e.preventDefault();

    const currentName = document.getElementById('role-current-name').value;
    const name = document.getElementById('role-name').value.trim();
    const description = document.getElementById('role-description').value.trim();
    const color = document.getElementById('role-color-text').value.trim() || '#5865F2';

    if (serverSettingsState.editingRole) {
        wsSend({
            cmd: 'role_update',
            name: currentName,
            description: description,
            color: color
        }, state.serverUrl);
    } else {
        wsSend({
            cmd: 'role_create',
            name: name,
            description: description,
            color: color
        }, state.serverUrl);
    }

    closeCreateRoleModal();
}

function deleteRole(roleName) {
    if (roleName === 'owner' || roleName === 'admin' || roleName === 'user') {
        alert('Cannot delete system roles.');
        return;
    }

    if (!confirm(`Are you sure you want to delete the role "${roleName}"?`)) return;

    wsSend({
        cmd: 'role_delete',
        name: roleName
    }, state.serverUrl);
}

/* Member Management */
function openMemberRolesModal(username) {
    const modal = document.getElementById('member-roles-modal');
    if (!modal) return;
    modal.classList.add('active');
    modal.style.display = 'flex';

    const member = serverSettingsState.members.find(m => m.username === username);
    if (!member) {
        closeMemberRolesModal();
        return;
    }

    serverSettingsState.selectedMember = member;

    const title = document.getElementById('member-roles-title');
    const memberInfo = document.getElementById('member-info-display');

    if (title) title.textContent = 'Manage Member Roles';
    if (memberInfo) {
        const escapedUsername = escapeHtml(username);
        const escapedRoles = (member.roles || []).map(r => escapeHtml(r)).join(', ') || 'No roles';
        memberInfo.innerHTML = `
    <div class="member-info-avatar">
    <img src="${getAvatarUrl(username)}" alt="${escapedUsername}">
    </div>
    <div class="member-info-details">
    <h3>${escapedUsername}</h3>
    <span class="member-info-username">${escapedRoles}</span>
    </div>
    `;
    }

    renderAvailableRoles();
}

function closeMemberRolesModal() {
    const modal = document.getElementById('member-roles-modal');
    modal.classList.remove('active');
    modal.style.display = 'none';
    serverSettingsState.selectedMember = null;
}

function renderAvailableRoles() {
    const rolesList = document.getElementById('available-roles-list');
    if (!rolesList) return;

    const currentRoles = serverSettingsState.selectedMember?.roles || [];

    rolesList.innerHTML = serverSettingsState.roles.map(role => {
        const escapedName = escapeHtml(role.name);
        const escapedColor = escapeHtml(role.color || '#5865F2');
        return `
    <div class="available-role-item ${currentRoles.includes(role.name) ? 'selected' : ''}" data-role="${escapedName}" onclick="toggleRoleSelection('${escapedName}')">
    <div class="role-checkbox">
    <i data-lucide="check"></i>
    </div>
    <div class="role-color-preview" style="width: 24px; height: 24px; background: ${escapedColor}"></div>
    <span class="available-role-name" style="color: ${escapedColor}">${escapedName}</span>
    </div>
    `;
    }).join('');

    if (window.lucide) {
        window.lucide.createIcons({ root: rolesList });
    }
}

let selectedRoles = [];

function toggleRoleSelection(roleName) {
    const roleItem = document.querySelector(`.available-role-item[data-role="${roleName}"]`);
    if (!roleItem) return;

    if (roleItem.classList.contains('selected')) {
        roleItem.classList.remove('selected');
        selectedRoles = selectedRoles.filter(r => r !== roleName);
    } else {
        roleItem.classList.add('selected');
        selectedRoles.push(roleName);
    }
}

function saveMemberRoles() {
    if (!serverSettingsState.selectedMember) return;

    const username = serverSettingsState.selectedMember.username;
    const currentRoles = serverSettingsState.selectedMember.roles || [];

    const rolesToAdd = selectedRoles.filter(r => !currentRoles.includes(r));
    const rolesToRemove = currentRoles.filter(r => !selectedRoles.includes(r));

    if (rolesToRemove.length > 0) {
        rolesToRemove.forEach(role => {
            wsSend({
                cmd: 'user_roles_remove',
                user: username,
                roles: [role]
            }, state.serverUrl);
        });
    }

    if (rolesToAdd.length > 0) {
        wsSend({
            cmd: 'user_roles_add',
            user: username,
            roles: rolesToAdd
        }, state.serverUrl);
    }

    selectedRoles = [];
    closeMemberRolesModal();
}

window.openServerSettings = openServerSettings;
window.closeServerSettings = closeServerSettings;
window.showServerSettingsSection = showServerSettingsSection;
window.loadChannels = loadChannels;
window.loadRoles = loadRoles;
window.loadMembers = loadMembers;
window.openCreateChannelModal = openCreateChannelModal;
window.openEditChannelModal = openEditChannelModal;
window.closeCreateChannelModal = closeCreateChannelModal;
window.updateChannelTypeFields = updateChannelTypeFields;
window.deleteChannel = deleteChannel;
window.moveChannelUp = moveChannelUp;
window.moveChannelDown = moveChannelDown;
window.openCreateRoleModal = openCreateRoleModal;
window.openEditRoleModal = openEditRoleModal;
window.closeCreateRoleModal = closeCreateRoleModal;
window.deleteRole = deleteRole;
window.openMemberRolesModal = openMemberRolesModal;
window.closeMemberRolesModal = closeMemberRolesModal;
window.renderAvailableRoles = renderAvailableRoles;
window.toggleRoleSelection = toggleRoleSelection;
window.saveMemberRoles = saveMemberRoles;
window.renderRoles = renderRoles;
