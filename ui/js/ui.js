var playerUI = {};

playerUI.statusTables = {};

playerUI.statusTables = [
	{
		videoElId 	: "mVid-mainContent",
		tableElId 	: "status-table-body0",
		entries 	: ["Play", "Buffer"]
	},
	{
		videoElId 	: "mVid-video0",
		tableElId 	: "status-table-body1",
		entries 	: ["Play", "Buffer"]
	},
	{
		videoElId 	: "mVid-video1",
		tableElId 	: "status-table-body2",
		entries 	: ["Play", "Buffer"]
	}
];

e = function (id) {
  return document.getElementById(id);
}

window.onload = function () {
	try {
		playerUI.start();
	} catch (error) {
		console.log("FATAL ERROR: " + error.message);
	}
}

playerUI.start = function () {
	var that 		= this;

	this.Log.init(e("log"));

	this.statusTables.forEach(function(statTable) {
		that.setupStatusTable(statTable);
	});
};

playerUI.setupStatusTable = function (tableInfo) {
	var tableBody = document.getElementById(tableInfo.tableElId);

	for (var i in tableInfo.entries) {
		var row = document.createElement("tr");
		var eventNameTd = document.createElement("td");
		eventNameTd.innerHTML = tableInfo.entries[i] + ": ";
		row.appendChild(eventNameTd);

		var countTd = document.createElement("td");
		countTd.setAttribute("id", "e_" + tableInfo.videoElId + "_" + tableInfo.entries[i]);
		countTd.innerHTML = "---";
		row.appendChild(countTd);

		tableBody.appendChild(row);
  }
};

playerUI.setPlayingState = function (state) {
	for (var s in this.playIconTable) {
		var playEl = document.getElementById(this.playIconTable[s].icon);
		if (playEl) {
			if (this.playIconTable[s].state === state) {
				playEl.style.display = "block";
			} else {
				playEl.style.display = "none";
			}
		}
	}
}

playerUI.Log = {};

playerUI.Log.init = function (logDiv) {
	this._div = logDiv;
};

playerUI.Log._write = function(message, cssClass) {
	var log;

	log = document.createElement("p");
	log.setAttribute("id", "log_" + this._logCount);
	log.setAttribute("class", cssClass);

	log.innerHTML = message;
	this._div.appendChild(log);
};

// listen for the ipc events
const ipc = require('electron').ipcRenderer; // Picks up messages sent through electrons internal IPC functions

ipc.on('ipc-log', function(event, message) {
	playerUI.Log._write(message.logText, message.cssClass);
	//console.log(message.logText);
});

ipc.on('ipc-status', function(event, message) {
	var t = e(message.id);
	if (t) t.innerHTML = message.text;
	//console.log(message.id + " " + message.text);
});

ipc.on('ipc-buffer', function(event, message) {
	try {
		var msgObj = JSON.parse(message.toString('utf8'));
		var pbObj = msgObj.playerBufferObj;
		var playerId = pbObj.id;
	} catch(err) {
		//console.log("ipc-buffer: message parse error. " + err.message);
		return;
	}

	//console.log(message);


	var playerBuffer 	= e(playerId + "-bufferBar");

	playerBuffer.value 		= pbObj.value;
	playerBuffer.max 		= pbObj.max;
});

ipc.on('ipc-playbackOffset', function(event, message) {
	var playerBar = e("playbackBar");

	try {
		var msgObj = JSON.parse(message.toString('utf8'));

		playerBar.max = msgObj.max;
		playerBar.value = msgObj.value;
	} catch(err) {
		console.log("ipc-playbackOffset: message parse error. " + err.message);
	}
});
