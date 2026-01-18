const axios = require("axios");

const BASE_URL = "http://localhost:8080";
const CHARGER_ID = 1;

// change statuses if you want
const STATUSES = ["ONLINE", "CHARGING", "IDLE", "ONLINE"];

let i = 0;

async function sendHeartbeat() {
  const status = STATUSES[i % STATUSES.length];
  i++;

  try {
    const res = await axios.post(`${BASE_URL}/device/heartbeat`, {
      chargerId: CHARGER_ID,
      status,
    });

    console.log(
      new Date().toISOString(),
      "Sent:",
      { chargerId: CHARGER_ID, status },
      "Got:",
      res.data
    );
  } catch (err) {
    if (err.response) {
      console.log("Error:", err.response.status, err.response.data);
    } else {
      console.log("Error:", err.message);
    }
  }
}

// send every 5 seconds
setInterval(sendHeartbeat, 5000);

// send immediately once
sendHeartbeat();
