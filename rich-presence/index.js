/**
 * Discord Rich Presence
 * Résultat : "Joue à  Stream .gg/btcl"
 * Avec image, timer, et sous-textes personnalisés.
 */

const { Client } = require('discord-rpc');

const CONFIG = {
  // Ton Application ID — discord.com/developers/applications
  // Le NOM de l'application dans le Dev Portal = ce qui s'affiche en gras
  // → Crée une application nommée exactement "Stream .gg/btcl"
  clientId: '1548764747707584613',

  // Ligne 1 sous le nom (optionnel)
  details: '.gg/btcl',

  // Ligne 2 (optionnel)
  state: '',

  // Image principale (clé uploadée dans Rich Presence → Art Assets du Dev Portal)
  // Laisse vide si tu n'as pas d'image
  largeImageKey: 'logo',       // nom de l'image uploadée dans le Dev Portal
  largeImageText: '.gg/btcl',  // texte au survol de l'image

  // Affiche le timer "depuis X:XX:XX"
  showTimestamp: true,
};

// ─────────────────────────────────────────────────────────────────────────────

const client = new Client({ transport: 'ipc' });

client.on('ready', () => {
  console.log(`✅ Connecté : ${client.user.username}`);

  const activity = {
    instance: false,
  };

  if (CONFIG.details)       activity.details       = CONFIG.details;
  if (CONFIG.state)         activity.state         = CONFIG.state;
  if (CONFIG.largeImageKey) activity.largeImageKey = CONFIG.largeImageKey;
  if (CONFIG.largeImageText)activity.largeImageText= CONFIG.largeImageText;
  if (CONFIG.showTimestamp) activity.startTimestamp = new Date();

  client.setActivity(activity).then(() => {
    console.log('🎮 Activité affichée sur ton profil !');
    console.log('   "Joue à  Stream .gg/btcl"');
    console.log('\nCtrl+C pour arrêter.\n');
  }).catch((err) => {
    console.error('❌ Erreur :', err.message);
  });
});

client.on('disconnected', () => {
  console.log('⚠️  Déconnecté de Discord. Rouvre Discord et relance.');
});

console.log('🔗 Connexion à Discord...\n');

client.login({ clientId: CONFIG.clientId }).catch((err) => {
  console.error('❌ Connexion impossible :', err.message);
  console.error('\nVérifies :');
  console.error('  1. Discord est ouvert sur ta machine');
  console.error('  2. clientId = ton Application ID');
  console.error('  3. Rich Presence activé dans le Developer Portal');
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt...');
  await client.clearActivity().catch(() => {});
  client.destroy();
  process.exit(0);
});
