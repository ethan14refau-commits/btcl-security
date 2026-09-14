# 🔴 Discord Rich Presence — Streaming

Affiche une activité **Streaming** sur ton profil Discord via l'API RPC officielle.  
Aucun self-bot. Aucun token utilisateur. Discord doit juste être ouvert.

---

## Ce que ça affiche sur ton profil

```
🔴 En direct sur Twitch
   STREAM — gg/btcl
   discord.gg/btcl
   [🔴 Regarder le stream]   ← bouton cliquable
```

---

## Étapes

### 1 — Créer une application Discord (si pas déjà fait)

1. Va sur https://discord.com/developers/applications
2. Clique **New Application** → donne-lui un nom (ex: "Mon Stream")
3. Copie le **Application ID** (= Client ID)
4. Va dans l'onglet **Rich Presence** → **Activer**
5. (Optionnel) Dans **Rich Presence → Art Assets**, upload une image et note sa clé

### 2 — Configurer l'app

Ouvre `index.js` et modifie le bloc `CONFIG` :

```js
const CONFIG = {
  clientId: 'COLLE_TON_CLIENT_ID_ICI',   // L'Application ID du Dev Portal
  details: '🔴 STREAM — gg/btcl',         // Ligne 1 sous ton pseudo
  state: 'discord.gg/btcl',               // Ligne 2
  streamUrl: 'https://www.twitch.tv/ton_pseudo',  // URL Twitch ou YouTube
  largeImageKey: '',   // Optionnel : clé d'image uploadée dans Rich Presence Assets
  largeImageText: '',  // Texte au survol
  showTimestamp: true, // Affiche "depuis X minutes"
};
```

### 3 — Installer et lancer

```bash
# Dans le dossier rich-presence/
npm install
npm start
```

---

## Prérequis

- Node.js installé (https://nodejs.org/)
- Discord **ouvert** sur ta machine (pas juste minimisé — il doit tourner)
- Une application Discord avec Rich Presence activé

---

## Erreurs fréquentes

| Erreur | Solution |
|---|---|
| `Could not connect` | Discord n'est pas ouvert, ou est en train de démarrer |
| `Invalid client id` | Le `clientId` dans `CONFIG` est incorrect |
| `RPC_CONNECTION_TIMEOUT` | Relance Discord puis réessaie |

---

## Pourquoi cette méthode ?

Discord ne permet pas de modifier la présence d'un compte utilisateur via OAuth2 ou l'API REST.  
La seule méthode officielle est le **Discord RPC** (IPC local) — c'est exactement ce que Discord utilise en interne quand tu lances un jeu.

Cette app fait la même chose : elle parle à Discord sur ta machine via une socket locale, et Discord met à jour ton activité.
