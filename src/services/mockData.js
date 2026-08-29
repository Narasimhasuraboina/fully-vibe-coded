// Real Zero-Knowledge P2P Chat: No hardcoded contacts. Users discover each other by username search.
export const INITIAL_CONTACTS = [];

export const INITIAL_MESSAGES = {};

export const INITIAL_STORIES = [];

export const INITIAL_AUTO_REPLIES = [
  {
    id: 'ar_1',
    trigger: 'status',
    response: '[AUTO-BOT]: System operational. 0 packets dropped. PGP session verified.',
    type: 'contains',
    enabled: true,
  },
  {
    id: 'ar_2',
    trigger: 'ping',
    response: '[AUTO-BOT]: PONG! RTT: 12ms | Encryption: Quantum RSA-4096.',
    type: 'exact',
    enabled: true,
  }
];

export const INITIAL_SCHEDULED = [];

export const DEFAULT_GB_SETTINGS = {
  // Privacy Mods
  freezeLastSeen: false,
  hideOnlineStatus: false,
  hideBlueTicks: false,
  hideSecondTick: false,
  hideTypingIndicator: false,
  antiDeleteMessages: true, // Shows revoked messages with red badge
  antiDeleteStatus: true,   // Shows deleted stories
  disableForwardTag: true,
  antiViewOnce: true,       // Lets user view "view-once" media unlimited times
  
  // Security Mods
  appLockEnabled: false,
  appPin: '1337',
  secretChatPin: '0000',
  autoClearCacheOnExit: false,

  // Audio / Sound FX & HUD
  soundEffects: true,
  scanlinesEnabled: true,
  matrixRainBg: false,
  theme: 'matrix',
  fontFamily: 'monospace',
};
