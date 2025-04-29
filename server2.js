const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');

const server = https.createServer({
  cert: fs.readFileSync('/etc/letsencrypt/live/art.a2isol.com/fullchain.pem'),
  key: fs.readFileSync('/etc/letsencrypt/live/art.a2isol.com/privkey.pem')
});

const wss = new WebSocket.Server({ server });


const MAX_CLIENTS = 3;
const roles = {}; // { LEFT: ws, CENTER: ws, RIGHT: ws }
const current_files = {} // { LEFT: "x.mp4", CENTER: "y.mp4", RIGHT: "z.mp4" }
let lastWasHorizontal = false; // Track what was shown last

filenames = [
  "1.mp4",
  "2.mp4",
  "3.mp4",
  "4.mp4",
  "5.mp4",
  "6.mp4",
  "7.mp4",
  "8.mp4",
  "9.mp4",
  "10.mp4",
  "11.mp4",
  "12.mp4",
]

horiz_filenames = [
  [
    "h_left.mp4",
    "h_centre.mp4",
    "h_right.mp4",
  ],
  [
    "h2_left.mp4",
    "h2_centre.mp4",
    "h2_right.mp4",
  ],
  [
    "h3_left.mp4",
    "h3_centre.mp4",
    "h3_right.mp4",
  ],
]

// Website -> Server messages:
// {action: "register", role: "LEFT" | "CENTER" | "RIGHT"} 
// {action: "tapped"}

// Website -> Server messages:
// show X.mp4
// reg success|error
function randomMp4(excludeList) {
    // Pick a random file NOT in excludeList
    const candidates = filenames.filter(f => !excludeList.includes(f));
    const num = Math.floor(Math.random() * candidates.length);
    return candidates[num];
  }

  function generate3Mp4s() {
    const newFiles = {};
    const used = Object.values(current_files);
  
    // 1 in 3 chance to show horizontal, ONLY if last time wasn't horizontal
    let showHoriz = false;
    if (!lastWasHorizontal && Math.random() < (1 / 3)) {
      showHoriz = true;
    }
  
    if (showHoriz) {
      console.log("🎥 Showing horizontal triplet!");
  
      // Pick one horizontal set randomly
      const horizSet = horiz_filenames[Math.floor(Math.random() * horiz_filenames.length)];
      newFiles.LEFT = horizSet[0];
      newFiles.CENTER = horizSet[1];
      newFiles.RIGHT = horizSet[2];
  
      lastWasHorizontal = true;
    } else {
      console.log("🎥 Showing 3 random unique mp4s!");
      newFiles.LEFT = randomMp4(used);
      used.push(newFiles.LEFT);
  
      newFiles.CENTER = randomMp4(used);
      used.push(newFiles.CENTER);
  
      newFiles.RIGHT = randomMp4(used);
  
      lastWasHorizontal = false;
    }
  
    return newFiles;
  }

  function broadcastNewMp4s() {
    const mp4s = generate3Mp4s();
  
    for (const [role, ws] of Object.entries(roles)) {
      if (ws.readyState === WebSocket.OPEN) {
        const file = mp4s[role];
        ws.send(`show ${file}`);
        console.log(`➡️ Sending ${file} to ${role}`);
        current_files[role] = file; // Update current file tracking
      }
    }
  }

wss.on('connection', (ws) => {
  console.log('🟢 New connection request');

  if (Object.keys(roles).length >= MAX_CLIENTS) {
    console.log('❌ Too many connections. Closing.');
    ws.send("Error: Maximum number of devices connected.");
    ws.close();
    return;
  }

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      console.error('Invalid JSON received.');
      return;
    }

    if (data.action === 'register') {
      const role = data.role;
      console.log(`📌 Registering role: ${role}`);

      if (roles[role]) {
        console.log(`❌ Role ${role} already taken.`);
        ws.send("reg error");
        ws.close();
        return;
      }

      roles[role] = ws;
      ws._role = role; // Attach role to socket
      ws.send("reg success");
      console.log(`✅  Role ${role} successfully registered`);
      if (Object.keys(roles).length === MAX_CLIENTS) {
        console.log('✅ All roles registered. Broadcasting GIFs.');
        broadcastNewMp4s();
      }
    }

    if (data.action === 'tapped') {
      console.log(ws._role)
      console.log(roles.length)
      if (ws._role && Object.keys(roles).length == 3) { // If this client is registered and we have 3 clients, send a new video
        console.log(`🎯 Tapped received from ${ws._role}`);
        broadcastNewMp4s();
      }
    }
  });

  ws.on('close', () => {
    if (ws._role) {
      console.log(`🔴 ${ws._role} disconnected`);
      delete roles[ws._role];
    }
  });
});

server.listen(443, () => {
    console.log('🚀 Secure WebSocket server running on https://art.a2isol.com');
  });
  