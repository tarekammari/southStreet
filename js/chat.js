/* ==========================================================================
   SOUTH STREET (سوث ستريت) - WhatsApp-Style Messaging Engine
   ========================================================================== */

class ChatEngine {
  constructor() {
    this.activeChatId = 'group-makkah';
  }

  initChatUI() {
    this.renderChatList();
    this.renderMessages();
    this.bindEvents();
  }

  setActiveChat(chatId) {
    this.activeChatId = chatId;
    this.renderChatList();
    this.renderMessages();
  }

  renderChatList() {
    const chatListEl = document.getElementById('chat-list-items');
    if (!chatListEl) return;

    const chats = [
      { id: 'group-makkah', name: 'حملة سوث ستريت الكبرى (مكة)', subtext: 'الشيخ أحمد: توجيهات الطواف...', time: '10:30 ص', unread: 0, avatar: '🕋' },
      { id: 'staff-private', name: 'طاقم الإدارة والمالية', subtext: 'الأستاذ طارق: تم تأكيد حجز الفندق', time: 'أمس', unread: 2, avatar: '💼' },
      { id: 'direct-guide', name: 'الشيخ أحمد بن علي (المرشد)', subtext: 'متصل الآن...', time: '09:45 ص', unread: 0, avatar: '👳' }
    ];

    chatListEl.innerHTML = chats.map(c => `
      <div class="chat-item ${c.id === this.activeChatId ? 'active' : ''}" onclick="window.chatEngine.setActiveChat('${c.id}')">
        <div class="chat-item-avatar">
          <div class="avatar-img">${c.avatar}</div>
          <span class="status-dot"></span>
        </div>
        <div class="flex-1">
          <div class="flex justify-between items-center">
            <span style="font-weight: 700; font-size: 0.9rem; color: #FFF;">${c.name}</span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${c.time}</span>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px;">
            ${c.subtext}
          </p>
        </div>
      </div>
    `).join('');
  }

  renderMessages() {
    const container = document.getElementById('chat-messages-body');
    if (!container) return;

    const session = window.appStore.getSession();
    const messages = window.appStore.getMessages(this.activeChatId);

    if (messages.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="margin-top: 3rem;">لا توجد رسائل سابقة في هذه القناة. ابدأ المحادثة المباشرة الآن.</div>`;
      return;
    }

    container.innerHTML = messages.map(m => {
      const isMe = session && (m.senderId === session.id || m.senderRole === session.role);
      let contentHtml = `<p>${m.text}</p>`;

      if (m.type === 'voice') {
        contentHtml = `
          <p style="font-size: 0.8rem; font-weight: bold; margin-bottom: 0.2rem;">🎙️ رسالة صوتيةإرشادية (${m.duration})</p>
          <div class="voice-note-card">
            <button class="btn-play-voice" onclick="window.chatEngine.playAudioTone()">▶</button>
            <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.2); border-radius: 4px; position: relative;">
              <div style="width: 45%; height: 100%; background: #00A884; border-radius: 4px;"></div>
            </div>
            <span style="font-size: 0.7rem;">${m.duration}</span>
          </div>
        `;
      } else if (m.type === 'location') {
        contentHtml = `
          <p>${m.text}</p>
          <div class="location-preview-card">
            <div class="location-map-fake">
              <span style="font-size: 1.5rem;">📍</span> <strong>خريطة التجمع المباشرة</strong>
            </div>
            <div class="location-info">
              <strong>${m.locationName}</strong>
              <div style="font-size: 0.72rem; color: var(--text-emerald); margin-top: 2px;">إحداثيات: ${m.coords}</div>
            </div>
          </div>
        `;
      }

      return `
        <div class="message-bubble ${isMe ? 'sent' : 'received'}">
          ${!isMe ? `<div style="font-size: 0.75rem; font-weight: bold; color: var(--gold-main); margin-bottom: 0.2rem;">${m.senderName}</div>` : ''}
          ${contentHtml}
          <div class="message-meta">
            <span>${m.time}</span>
            ${isMe ? `<span class="double-check">✔✔</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  sendMessage(type = 'text', customText = null, locationData = null) {
    const inputEl = document.getElementById('chat-input-text');
    const text = customText || (inputEl ? inputEl.value.trim() : '');

    if (!text && type === 'text') return;

    const session = window.appStore.getSession() || {
      id: 'GUEST-01',
      name: 'معتمر زائر',
      role: 'pilgrim'
    };

    const newMsg = {
      id: `MSG-${Date.now()}`,
      chatId: this.activeChatId,
      senderId: session.id,
      senderName: `${session.name} (${session.roleName || 'معتمر'})`,
      senderRole: session.role,
      text: text,
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      type: type,
      status: 'read'
    };

    if (type === 'location' && locationData) {
      newMsg.locationName = locationData.name;
      newMsg.coords = locationData.coords;
    }

    window.appStore.addMessage(newMsg);

    if (inputEl) inputEl.value = '';
    this.renderMessages();
    this.playAudioTone(800, 0.05);

    // Auto simulated reply from Murshid for demo interactivity if pilgrim sends a message
    if (session.role === 'pilgrim') {
      setTimeout(() => {
        const guideReply = {
          id: `MSG-REPLY-${Date.now()}`,
          chatId: this.activeChatId,
          senderId: 'USR-003',
          senderName: 'الشيخ أحمد بن علي (مرشد)',
          senderRole: 'murshid',
          text: `حياك الله أخي ${session.name}. تم استلام استفسارك، الفوج يتجه حالياً إلى المسعى. يرجى متابعة المجمّع.`,
          time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          type: 'text',
          status: 'read'
        };
        window.appStore.addMessage(guideReply);
        this.renderMessages();
        this.playAudioTone(1000, 0.1);
      }, 2000);
    }
  }

  shareLocation() {
    const locations = [
      { name: 'باب الملك عبد العزيز - الحرم المكي', coords: '21.4190, 39.8260' },
      { name: 'فندق سويس أوتيل المقام - برج الساعة', coords: '21.4187, 39.8256' },
      { name: 'محطة حافلات أجياد - مكة المكرمة', coords: '21.4172, 39.8288' }
    ];
    const loc = locations[Math.floor(Math.random() * locations.length)];
    this.sendMessage('location', `موقعي الجغرافي المباشر: ${loc.name}`, loc);
  }

  playAudioTone(freq = 600, duration = 0.1) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log('Audio Context not available');
    }
  }

  bindEvents() {
    const sendBtn = document.getElementById('btn-chat-send');
    if (sendBtn) {
      sendBtn.onclick = () => this.sendMessage('text');
    }

    const inputEl = document.getElementById('chat-input-text');
    if (inputEl) {
      inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') this.sendMessage('text');
      };
    }
  }
}

window.chatEngine = new ChatEngine();
