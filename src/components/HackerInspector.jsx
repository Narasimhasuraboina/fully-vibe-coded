import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal as TerminalIcon, 
  Activity, 
  ShieldCheck, 
  Bot, 
  Calendar, 
  X, 
  Plus, 
  Trash2, 
  Send, 
  Eye, 
  Sliders
} from 'lucide-react';
import { soundFX } from '../services/audioService';
import { THEMES } from '../themes';

const HackerInspector = ({
  isOpen,
  onClose,
  gbSettings,
  setGbSettings,
  autoReplies,
  setAutoReplies,
  scheduledMessages,
  setScheduledMessages,
  setTheme,
  contacts,
  onBroadcastMessage,
  onClearAllData,
  onSendMessageToContact,
}) => {
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'packets' | 'gb_mods' | 'auto_bot' | 'scheduler'
  
  // Terminal State
  const [terminalHistory, setTerminalHistory] = useState([
    { type: 'sys', text: 'CHATFORGE CYBER-OS KERNEL v4.09.2 [x86_64-p2p-quantum]' },
    { type: 'sys', text: 'Type "help" to display available hacker commands.' },
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const terminalEndRef = useRef(null);

  // Packet Sniffer State
  const [packets, setPackets] = useState([]);
  const [isSniffing, setIsSniffing] = useState(true);

  // Auto-Reply Form State
  const [newTrigger, setNewTrigger] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [newTriggerType, setNewTriggerType] = useState('contains');

  // Scheduler Form State
  const [schedContactId, setSchedContactId] = useState(contacts[0]?.id || '');
  const [schedMsg, setSchedMsg] = useState('');
  const [schedTime, setSchedTime] = useState('23:59');

  // Generate real-time packets
  useEffect(() => {
    if (!isSniffing) return;
    const interval = setInterval(() => {
      const protocols = ['TLS_AES_256_GCM', 'WSS_PGP_SIG', 'SYN_ACK', 'DNS_OVER_HTTPS', 'MESH_ROUTE_0x9'];
      const ips = ['198.51.100.42', '203.0.113.19', '192.0.2.77', '185.220.101.5', '10.240.99.1'];
      const proto = protocols[Math.floor(Math.random() * protocols.length)];
      const src = ips[Math.floor(Math.random() * ips.length)];
      const size = Math.floor(64 + Math.random() * 1400);
      const hex = Array.from({ length: 8 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(' ');

      const newPacket = {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        src,
        dst: '10.13.37.1 (LOCAL)',
        protocol: proto,
        length: `${size} B`,
        hexDump: `0x00: ${hex}`,
      };

      setPackets((prev) => [newPacket, ...prev.slice(0, 49)]);
    }, 1400);

    return () => clearInterval(interval);
  }, [isSniffing]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalHistory]);

  const handleTerminalSubmit = (e) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    soundFX.playCommandExec();
    const cmdLine = terminalInput.trim();
    const [cmd, ...args] = cmdLine.split(' ');

    const newLogs = [...terminalHistory, { type: 'input', text: `$ ${cmdLine}` }];

    switch (cmd.toLowerCase()) {
      case 'help':
        newLogs.push({
          type: 'output',
          text: `AVAILABLE COMMANDS:
  help              - Show this menu
  clear             - Clear terminal screen
  status            - System & GB-Mod health diagnostics
  scan              - Scan active frequency nodes
  ghost <on|off>    - Toggle stealth ghost mode
  theme <name>      - Set theme: matrix, cyberpunk, kali, amber, bloodOps
  blast <msg>       - Broadcast mass message payload
  nuke              - Wipe all local buffers & logs
  ping              - Test latency to quantum relays
  whoami            - Display operator clearance credentials`,
        });
        break;

      case 'clear':
        setTerminalHistory([]);
        setTerminalInput('');
        return;

      case 'status':
        newLogs.push({
          type: 'output',
          text: `[SYSTEM DIAGNOSTICS]
• Kernel: Chatforge v4.09 Encrypted Mesh
• Ghost Mode: ${gbSettings.freezeLastSeen ? 'ENABLED (Stealth Active)' : 'DISABLED'}
• Anti-Delete Engine: ${gbSettings.antiDeleteMessages ? 'ACTIVE (Revoke Interceptor ON)' : 'OFF'}
• Active Nodes: ${contacts.length} Connected
• Quantum Cryptography: RSA-4096 / AES-256 GCM (0 Vulnerabilities)`,
        });
        break;

      case 'scan':
        newLogs.push({
          type: 'output',
          text: `[SCANNING SPECTRUM...]
${contacts.map(c => ` > [NODE: ${c.name.padEnd(14)}] IP: ${c.ip.padEnd(16)} STATUS: ${c.status.toUpperCase()}`).join('\n')}`,
        });
        break;

      case 'ghost':
        if (args[0] === 'on') {
          setGbSettings(prev => ({ ...prev, freezeLastSeen: true, hideOnlineStatus: true, hideBlueTicks: true }));
          newLogs.push({ type: 'output', text: '>> GHOST PROTOCOL ACTIVATED. Last seen frozen.' });
        } else if (args[0] === 'off') {
          setGbSettings(prev => ({ ...prev, freezeLastSeen: false, hideOnlineStatus: false, hideBlueTicks: false }));
          newLogs.push({ type: 'output', text: '>> GHOST PROTOCOL DEACTIVATED. Broadcasting presence.' });
        } else {
          newLogs.push({ type: 'error', text: 'Usage: ghost on | ghost off' });
        }
        break;

      case 'theme':
        if (args[0] && THEMES[args[0]]) {
          setTheme(args[0]);
          newLogs.push({ type: 'output', text: `>> Theme switched to [${THEMES[args[0]].name}]` });
        } else {
          newLogs.push({ type: 'error', text: `Available themes: ${Object.keys(THEMES).join(', ')}` });
        }
        break;

      case 'blast':
        if (args.length > 0) {
          const blastText = args.join(' ');
          onBroadcastMessage(blastText);
          newLogs.push({ type: 'output', text: `>> Broadcast payload sent to ${contacts.length} nodes!` });
        } else {
          newLogs.push({ type: 'error', text: 'Usage: blast <message payload>' });
        }
        break;

      case 'nuke':
        onClearAllData();
        newLogs.push({ type: 'error', text: '>> ALL SYSTEM BUFFERS, LOGS & CHATS PURGED.' });
        break;

      case 'ping':
        newLogs.push({ type: 'output', text: '64 bytes from zion-core.relay: seq=1 ttl=64 time=11.4 ms' });
        break;

      case 'whoami':
        newLogs.push({ type: 'output', text: 'OPERATOR: Root // CLEARANCE: Level-5 Black Ops // NODE: 0x1337' });
        break;

      default:
        newLogs.push({ type: 'error', text: `command not recognized: "${cmd}". Type "help" for command list.` });
        break;
    }

    setTerminalHistory(newLogs);
    setTerminalInput('');
  };

  const handleAddAutoReply = (e) => {
    e.preventDefault();
    if (!newTrigger.trim() || !newResponse.trim()) return;

    soundFX.playKeypress();
    const rule = {
      id: `ar_${Date.now()}`,
      trigger: newTrigger.trim().toLowerCase(),
      response: newResponse.trim(),
      type: newTriggerType,
      enabled: true,
    };

    setAutoReplies(prev => [...prev, rule]);
    setNewTrigger('');
    setNewResponse('');
  };

  const toggleAutoReply = (id) => {
    soundFX.playKeypress();
    setAutoReplies(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteAutoReply = (id) => {
    soundFX.playKeypress();
    setAutoReplies(prev => prev.filter(r => r.id !== id));
  };

  const handleAddSchedule = (e) => {
    e.preventDefault();
    if (!schedMsg.trim()) return;

    soundFX.playKeypress();
    const contact = contacts.find(c => c.id === schedContactId) || contacts[0];
    const newSched = {
      id: `sch_${Date.now()}`,
      contactId: contact.id,
      contactName: contact.name,
      message: schedMsg.trim(),
      scheduledTime: schedTime || '23:59',
      status: 'pending',
    };

    setScheduledMessages(prev => [...prev, newSched]);
    setSchedMsg('');
  };

  const deleteScheduled = (id) => {
    soundFX.playKeypress();
    setScheduledMessages(prev => prev.filter(s => s.id !== id));
  };

  const dispatchScheduledNow = (item) => {
    soundFX.playSent();
    onSendMessageToContact(item.contactId, {
      type: 'text',
      text: `[SCHEDULED DISPATCH]: ${item.message}`,
    });
    setScheduledMessages(prev => prev.filter(s => s.id !== item.id));
  };

  return (
    <div className={`hacker-inspector-drawer ${isOpen ? 'open' : ''}`}>
      {/* Drawer Header */}
      <div className="inspector-header">
        <div className="drawer-title">
          <TerminalIcon size={16} className="text-accent" />
          <span>CYBER-CONSOLE & GB-MODS</span>
        </div>
        <button className="btn-close-drawer" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Tabs Row */}
      <div className="inspector-tabs">
        <button 
          className={`tab-link ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => { soundFX.playKeypress(); setActiveTab('terminal'); }}
        >
          <TerminalIcon size={13} />
          <span>CLI</span>
        </button>

        <button 
          className={`tab-link ${activeTab === 'packets' ? 'active' : ''}`}
          onClick={() => { soundFX.playKeypress(); setActiveTab('packets'); }}
        >
          <Activity size={13} />
          <span>SNIFFER</span>
        </button>

        <button 
          className={`tab-link ${activeTab === 'gb_mods' ? 'active' : ''}`}
          onClick={() => { soundFX.playKeypress(); setActiveTab('gb_mods'); }}
        >
          <ShieldCheck size={13} />
          <span>GB-MODS</span>
        </button>

        <button 
          className={`tab-link ${activeTab === 'auto_bot' ? 'active' : ''}`}
          onClick={() => { soundFX.playKeypress(); setActiveTab('auto_bot'); }}
        >
          <Bot size={13} />
          <span>AUTO-BOT</span>
        </button>

        <button 
          className={`tab-link ${activeTab === 'scheduler' ? 'active' : ''}`}
          onClick={() => { soundFX.playKeypress(); setActiveTab('scheduler'); }}
        >
          <Calendar size={13} />
          <span>SCHEDULER</span>
        </button>
      </div>

      {/* Drawer Content */}
      <div className="inspector-body">
        
        {/* TAB 1: INTERACTIVE CLI TERMINAL */}
        {activeTab === 'terminal' && (
          <div className="terminal-container">
            <div className="terminal-output">
              {terminalHistory.map((item, idx) => (
                <div key={idx} className={`term-line term-${item.type}`}>
                  <pre>{item.text}</pre>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>

            <form onSubmit={handleTerminalSubmit} className="terminal-input-form">
              <span className="term-prompt">operator@forge:~$</span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                placeholder="type command (help, status, scan, blast)..."
                className="term-input"
                autoFocus
              />
            </form>
          </div>
        )}

        {/* TAB 2: PACKET SNIFFER */}
        {activeTab === 'packets' && (
          <div className="sniffer-container">
            <div className="sniffer-controls">
              <span className="sniffer-status">
                <span className="dot-live"></span>
                STREAMING PACKETS ({packets.length} CAPTURED)
              </span>
              <button 
                className="cyber-btn btn-sm"
                onClick={() => setIsSniffing(!isSniffing)}
              >
                {isSniffing ? 'PAUSE CAPTURE' : 'RESUME CAPTURE'}
              </button>
            </div>

            <div className="packets-table-wrapper">
              <table className="packets-table">
                <thead>
                  <tr>
                    <th>TIME</th>
                    <th>SOURCE</th>
                    <th>PROTOCOL</th>
                    <th>HEX DUMP</th>
                  </tr>
                </thead>
                <tbody>
                  {packets.map((p) => (
                    <tr key={p.id}>
                      <td className="p-time">{p.time}</td>
                      <td className="p-src">{p.src}</td>
                      <td className="p-proto">{p.protocol}</td>
                      <td className="p-hex">{p.hexDump}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: GBWHATSAPP POWER MODS & PRIVACY */}
        {activeTab === 'gb_mods' && (
          <div className="gb-mods-container">
            <div className="mod-group">
              <div className="group-title">
                <Eye size={14} className="text-accent" />
                <span>STEALTH & PRIVACY ENHANCEMENTS</span>
              </div>

              <div className="mod-item">
                <div className="mod-info">
                  <span className="mod-name">Freeze Last Seen</span>
                  <span className="mod-desc">Shows a fixed historical timestamp to other users</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={gbSettings.freezeLastSeen}
                  onChange={(e) => setGbSettings(prev => ({ ...prev, freezeLastSeen: e.target.checked }))}
                />
              </div>

              <div className="mod-item">
                <div className="mod-info">
                  <span className="mod-name">Hide Online Status</span>
                  <span className="mod-desc">Masks your online presence across all nodes</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={gbSettings.hideOnlineStatus}
                  onChange={(e) => setGbSettings(prev => ({ ...prev, hideOnlineStatus: e.target.checked }))}
                />
              </div>

              <div className="mod-item">
                <div className="mod-info">
                  <span className="mod-name">Hide Blue Ticks (Read Receipts)</span>
                  <span className="mod-desc">Contacts only see single/double grey ticks</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={gbSettings.hideBlueTicks}
                  onChange={(e) => setGbSettings(prev => ({ ...prev, hideBlueTicks: e.target.checked }))}
                />
              </div>

              <div className="mod-item">
                <div className="mod-info">
                  <span className="mod-name">Hide Typing / Recording Indicator</span>
                  <span className="mod-desc">Suppresses the typing payload broadcast</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={gbSettings.hideTypingIndicator}
                  onChange={(e) => setGbSettings(prev => ({ ...prev, hideTypingIndicator: e.target.checked }))}
                />
              </div>
            </div>

            <div className="mod-group">
              <div className="group-title">
                <ShieldCheck size={14} className="text-accent" />
                <span>ANTI-REVOKE & SECURITY ENGINE</span>
              </div>

              <div className="mod-item">
                <div className="mod-info">
                  <span className="mod-name">Anti-Delete Messages</span>
                  <span className="mod-desc">Preserves messages even after sender revokes them</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={gbSettings.antiDeleteMessages}
                  onChange={(e) => setGbSettings(prev => ({ ...prev, antiDeleteMessages: e.target.checked }))}
                />
              </div>

              <div className="mod-item">
                <div className="mod-info">
                  <span className="mod-name">Anti-Delete Status (Stories)</span>
                  <span className="mod-desc">Enables viewing deleted contact stories</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={gbSettings.antiDeleteStatus}
                  onChange={(e) => setGbSettings(prev => ({ ...prev, antiDeleteStatus: e.target.checked }))}
                />
              </div>

              <div className="mod-item">
                <div className="mod-info">
                  <span className="mod-name">Anti-View Once Bypass</span>
                  <span className="mod-desc">Allows viewing view-once payloads repeatedly</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={gbSettings.antiViewOnce}
                  onChange={(e) => setGbSettings(prev => ({ ...prev, antiViewOnce: e.target.checked }))}
                />
              </div>

              <div className="mod-item">
                <div className="mod-info">
                  <span className="mod-name">Disable 'Forwarded' Tag</span>
                  <span className="mod-desc">Forwards messages without sender attribution tag</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={gbSettings.disableForwardTag}
                  onChange={(e) => setGbSettings(prev => ({ ...prev, disableForwardTag: e.target.checked }))}
                />
              </div>
            </div>

            <div className="mod-group">
              <div className="group-title">
                <Sliders size={14} className="text-accent" />
                <span>DESKTOP DISPLAY & HUD</span>
              </div>

              <div className="mod-item">
                <div className="mod-info">
                  <span className="mod-name">Matrix Background Rain</span>
                  <span className="mod-desc">Renders animated green digital glyph rain</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={gbSettings.matrixRainBg}
                  onChange={(e) => setGbSettings(prev => ({ ...prev, matrixRainBg: e.target.checked }))}
                />
              </div>

              <div className="mod-item">
                <div className="mod-info">
                  <span className="mod-name">CRT Scanlines Overlay</span>
                  <span className="mod-desc">Vintage phosphor display scanline simulation</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={gbSettings.scanlinesEnabled}
                  onChange={(e) => setGbSettings(prev => ({ ...prev, scanlinesEnabled: e.target.checked }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AUTO-REPLY BOT BUILDER */}
        {activeTab === 'auto_bot' && (
          <div className="auto-bot-container">
            <div className="panel-hint">
              <span>Automatic trigger response engine. When contacts message you, the bot evaluates keyword triggers and dispatches responses.</span>
            </div>

            {/* Add New Rule */}
            <form onSubmit={handleAddAutoReply} className="auto-reply-form">
              <div className="form-title">
                <Plus size={14} /> <span>CREATE NEW AUTO-RESPONSE RULE</span>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label>TRIGGER KEYWORD / PHRASE:</label>
                  <input 
                    type="text" 
                    placeholder="e.g. status, password, help" 
                    value={newTrigger}
                    onChange={(e) => setNewTrigger(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>MATCH TYPE:</label>
                  <select 
                    value={newTriggerType} 
                    onChange={(e) => setNewTriggerType(e.target.value)}
                  >
                    <option value="contains">Contains Word</option>
                    <option value="exact">Exact Match</option>
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label>AUTO RESPONSE PAYLOAD:</label>
                <textarea 
                  placeholder="[AUTO-BOT]: Payload to send back..."
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  rows={2}
                  required
                />
              </div>

              <button type="submit" className="cyber-btn btn-primary btn-full">
                <Plus size={14} /> ADD TRIGGER RULE
              </button>
            </form>

            {/* Active Rules List */}
            <div className="rules-list">
              <span className="section-label">ACTIVE AUTO-RESPONSE RULES ({autoReplies.length})</span>
              {autoReplies.map((rule) => (
                <div key={rule.id} className="rule-card">
                  <div className="rule-header">
                    <span className="rule-trigger">
                      TRIGGER: <span className="highlight">"{rule.trigger}"</span> ({rule.type})
                    </span>
                    <div className="rule-actions">
                      <button 
                        className={`toggle-rule-btn ${rule.enabled ? 'enabled' : ''}`}
                        onClick={() => toggleAutoReply(rule.id)}
                      >
                        {rule.enabled ? 'ACTIVE' : 'OFF'}
                      </button>
                      <button className="btn-del-rule" onClick={() => deleteAutoReply(rule.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="rule-body">
                    <p>{rule.response}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: MESSAGE SCHEDULER */}
        {activeTab === 'scheduler' && (
          <div className="scheduler-container">
            <div className="panel-hint">
              <span>Schedule automated signal transmissions to contacts at designated times.</span>
            </div>

            {/* Schedule New Message */}
            <form onSubmit={handleAddSchedule} className="schedule-form">
              <div className="form-title">
                <Calendar size={14} /> <span>SCHEDULE NEW TRANSMISSION</span>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label>TARGET NODE:</label>
                  <select 
                    value={schedContactId} 
                    onChange={(e) => setSchedContactId(e.target.value)}
                  >
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.tag})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>SCHEDULE TIME (UTC):</label>
                  <input 
                    type="time" 
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label>MESSAGE PAYLOAD:</label>
                <textarea 
                  placeholder="Enter message to dispatch at schedule time..."
                  value={schedMsg}
                  onChange={(e) => setSchedMsg(e.target.value)}
                  rows={2}
                  required
                />
              </div>

              <button type="submit" className="cyber-btn btn-primary btn-full">
                <Calendar size={14} /> QUEUE SCHEDULED TRANSMISSION
              </button>
            </form>

            {/* Scheduled Queue */}
            <div className="scheduled-queue">
              <span className="section-label">PENDING QUEUE ({scheduledMessages.length})</span>
              {scheduledMessages.length === 0 ? (
                <div className="empty-queue">No transmissions currently queued.</div>
              ) : (
                scheduledMessages.map((item) => (
                  <div key={item.id} className="scheduled-card">
                    <div className="scheduled-head">
                      <span className="sched-target">TARGET: {item.contactName}</span>
                      <span className="sched-time">TIME: {item.scheduledTime} UTC</span>
                    </div>
                    <p className="sched-text">{item.message}</p>
                    <div className="sched-actions">
                      <button className="cyber-btn btn-sm" onClick={() => dispatchScheduledNow(item)}>
                        <Send size={12} /> DISPATCH NOW
                      </button>
                      <button className="btn-del-rule" onClick={() => deleteScheduled(item.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default HackerInspector;
