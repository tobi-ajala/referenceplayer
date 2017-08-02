var mVid = {};

mVid.videoEvents = Object.freeze({
  LOAD_START		: "loadstart",
  PROGRESS			: "progress",
  SUSPEND			: "suspend",
  ABORT				: "abort",
  ERROR				: "error",
  EMPTIED			: "emptied",
  STALLED			: "stalled",
  LOADED_METADATA	: "loadedmetadata",
  LOADED_DATA		: "loadeddata",
  CAN_PLAY			: "canplay",
  CAN_PLAY_THROUGH	: "canplaythrough",
  PLAYING			: "playing",
  WAITING			: "waiting",
  SEEKING			: "seeking",
  SEEKED			: "seeked",
  ENDED				: "ended",
  DURATION_CHANGE	: "durationchange",
  TIME_UPDATE		: "timeupdate",
  PLAY				: "play",
  PAUSE				: "pause",
  RATE_CHANGE		: "ratechange",
  RESIZE			: "resize",
  VOLUME_CHANGE		: "volumechange",
});

var content = {};
content.currentBufferingIdx = 0;
content.currentPlayingIdx 	= 0;

content.list = [
	{
		playerId : "mVid-video0",
		src : "http://cdn.http.anno.test.channel4.com/m/1/174055/7/2047111/MUM-HATD170-020_1462888808_93626_17.mp4",
		type : "video/mp4",
		transitionTime : -1
	},
	{
		playerId : "mVid-video1",
		src : "http://cdn.http.anno.test.channel4.com/m/1/174055/78/1340110/CH4_31_02_50_GRY_BHFN133_040_001_93614_17.mp4",
		type : "video/mp4",
		transitionTime : -1
	},
	{
		playerId : "mVid-video0",
		src : "http://cdn.http.anno.test.channel4.com/m/1/174055/77/1340109/CH4_31_02_50_AMV_SYPR030_030_001_93613_17.mp4",
		type : "video/mp4",
		transitionTime : -1
	},
	{
		playerId : "mVid-video1",
		src : "http://cdn.http.anno.test.channel4.com/m/1/174055/110/1858926/CH4_31_02_50_CH4154DGGEN00021I01_002_1462888026_93623_17.mp4",
		type : "video/mp4",
		transitionTime : -1
	},
	{
		playerId : "mVid-mainContent",
		src : "http://rdmedia.bbc.co.uk/dash/ondemand/bbb/2/client_manifest-common_init.mpd",
		type : "application/dash+xml",
		transitionTime : 60
	},
];

const PRELOAD_NEXT_AD_S = 5; //How long before the end to start preloading

mVid.Log = {}; //Log errors & any warning & info & goes through express && printed out in exprress

mVid.Log.error = function (message) { //Displaying log in electron
	this._write("ERROR: " + message, "error");
};

mVid.Log.warn = function (message) {
	this._write("WARN: " + message, "warn");
};

mVid.Log.info = function (message) {
	this._write("INFO: " + message, "info");
};

mVid.Log.debug = function (message) {
	this._write("DEBUG: " + message, "debug");
};

mVid.Log._write = function(message, cssClass) {
	var log;

	var out = "cssClass=" + cssClass + "&";
	out += "logText=" + message;

	// Send a xhr/ajax POST request with the serialized media events
	var xhttp = new XMLHttpRequest();
	xhttp.open("POST", "/log", true);
	xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	xhttp.send(out);
};


e = function (id) {
  return document.getElementById(id);
}

window.onload = function () { // Sets up the event listening & shoots through arrays - catching all the events for the event listeners
	try {
		mVid.start();
	} catch (error) {
		mVid.Log.error("FATAL ERROR: " + error.message);
	}
}

mVid.start = function () {
	var mainVideo;
	var that 		= this;

	this.socket = io();

	mainVideo = e("mVid-mainContent");

	for(var i in this.videoEvents) {
		mainVideo.addEventListener(this.videoEvents[i], this.onVideoEvent);
	}

	mainVideo.restartPoint = 0;

	window.setInterval( function() {
		that.updateBufferBars();
	}, 1000); // Updating buffer bars in electron - tracking


	this.setContentSourceAndLoad();
};

mVid.createPlayer = function (playerId) { // Player = just a video object
	this.Log.info("createPlayer: " + playerId);

	var player = document.createElement("video");

    player.setAttribute("id", playerId);
	player.style.display = "none";

	var source = document.createElement("source");

    source.setAttribute("id", playerId + "-source");
    source.setAttribute("preload", "auto");

	player.appendChild(source);

	e("player-container").appendChild(player);

	for(var i in this.videoEvents) {
		player.addEventListener(this.videoEvents[i], this.onVideoEvent);
	}

	this.statusTableText(playerId, "Play", "---");
	this.statusTableText(playerId, "Buffer", "---");
	this.statusTableText(playerId, "Type", "---");

	return player;
}

mVid.purgePlayer = function (playerId) {
	this.Log.info("purgePlayer: " + playerId); // Destroys the ad player by stripping out the source

	var player = e(playerId);

	if (player) {
		player.pause();
		player.src="";

		player.removeAttribute("src");
		player.removeAttribute("source");
		player.innerHTML = ""; // Why is the <source> placed in here!?
		player.load();
		player.parentNode.removeChild(player);
		player=null;	// Don't really need this...
	}
}

mVid.updateBufferBars = function() { // Updating buffer bars for the objects
	this.updateBufferBar("mVid-mainContent");
	this.updateBufferBar("mVid-video0");
	this.updateBufferBar("mVid-video1");
}

mVid.updateBufferBar = function(playerId) {
	var playerBuffer 	= {};
	var player 			= e(playerId);

	if (player)
	{
		var buffer 			= player.buffered;
		var duration 		= player.duration;
		var offset;

		offset = (player.paused) ? 0 : player.currentTime;

		if (duration && (duration > 0)) {
			playerBuffer.max = duration;

			if ((buffer.length > 0) && (player.currentTime < player.duration) /* !player.ended */) {
				playerBuffer.value = buffer.end(buffer.length-1);
			} else {
				playerBuffer.value = 0;
			}
		} else
		{
			playerBuffer.value = 0;
			playerBuffer.max = 60;
		}
	}

	// Send state over io sockets
	var pbObj = "\"playerBufferObj\": {"; // JSON structure to send over socket.io
	pbObj += "\"id\":" + JSON.stringify(playerId) + ",";
	if (player)	{
		pbObj += "\"value\":" + JSON.stringify('' + playerBuffer.value) + ",";
		pbObj += "\"max\":" + JSON.stringify('' + playerBuffer.max) + ",";
		pbObj += "\"currentTime\":" + JSON.stringify('' + player.currentTime) + ",";
		pbObj += "\"duration\":" + JSON.stringify('' + player.duration);
	} else {
		pbObj += "\"value\":\"0\",";
		pbObj += "\"max\":\"0\",";
		pbObj += "\"currentTime\":\"0\",";
		pbObj += "\"duration\":\"0\"";
	}
	pbObj += "}";
	var out = "{" + pbObj + "}";

	this.socket.emit('bufferEvent', out);
}

mVid.updatePlaybackBar = function(playerId) { // Function to track playing status
	var playerBar 		= {};
	var player 			= e(playerId);

	if (player) {
		var duration 		= player.duration;

		if (duration && (duration > 0)) {
			playerBar.max = duration;
			playerBar.value = player.currentTime;
		} else
		{
			playerBar.value = 0;
			playerBar.max = 100;
		}

		var out = "{";
		out += "\"value\":" + JSON.stringify('' + playerBar.value) + ",";
		out += "\"max\":" + JSON.stringify('' + playerBar.max);
		out += "}";

		this.socket.emit('playbackOffset', out);
	}
}

mVid.postStatusUpdate = function (id, text) {
	var out = "id=" + id + "&" + "text=" + text;

	// Send a xhr/ajax POST request with the serialized media events
	var xhttp = new XMLHttpRequest();
	xhttp.open("POST", "/status", true);
	xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	xhttp.send(out);
}

mVid.statusTableText = function (playerId, textEntry, text) {
	this.postStatusUpdate("e_" + playerId + "_" + textEntry, text);
}

mVid.getCurrentBufferingPlayer = function () {
	//this.Log.info("getCurrentBufferingPlayer: " + content.list[content.currentBufferingIdx].playerId);
	var idx = content.currentBufferingIdx;
	var playerId = content.list[idx].playerId;
	var player = e(playerId);

	if (!player) {
		this.createPlayer(playerId);
		player = e(playerId);
	}

	return player;
}

mVid.getCurrentPlayingPlayer = function () { // Easy way of telling us which player is currently buffering
	//this.Log.info("getCurrentPlayingPlayer: " + content.list[content.currentPlayingIdx].playerId);
	var idx = content.currentPlayingIdx;

	return e(content.list[idx].playerId);
}

mVid.getBufferingContentIdx = function () {
	//this.Log.info("getBufferingContentIdx: " + content.currentBufferingIdx);
	return content.currentBufferingIdx;
}

mVid.getPlayingContentIdx = function () {
	//this.Log.info("getPlayingContentIdx: " + content.currentPlayingIdx);
	return content.currentPlayingIdx;
}

mVid.getTransitionTime = function () { // Just to get the 60 seconds value back from the main content
	return content.list[content.currentPlayingIdx].transitionTime;
}

mVid.setContentSourceAndLoad = function () {
	var player;

	player = this.getCurrentBufferingPlayer();
	this.Log.info(player.id + " setContentSourceAndLoad - currentBufferingIdx: " + content.currentBufferingIdx);

	this.setSourceAndLoad(player, content.list[content.currentBufferingIdx].src, content.list[content.currentBufferingIdx].type);
}

mVid.skipBufferingToNextPlayer = function () { // Once buffering is finished & ready to start buffering the next
	if (++content.currentBufferingIdx >= content.list.length) {
		content.currentBufferingIdx = 0;
	}
	this.Log.info("skipBufferingToNextPlayer: " + content.currentBufferingIdx);
	this.postStatusUpdate("BufferIdx", content.currentBufferingIdx);
}

mVid.skipPlayingToNextPlayer = function () {
	if (++content.currentPlayingIdx >= content.list.length) {
		content.currentPlayingIdx = 0;
	}
	this.Log.info("skipPlayingToNextPlayer: " + content.currentPlayingIdx);
	this.postStatusUpdate("PlayingIdx", content.currentPlayingIdx);
}

mVid.isMainFeaturePlayer = function (player) {
	return (player.id == "mVid-mainContent");
}

mVid.setSourceAndLoad = function (player, src, type) {
	this.Log.info(player.id + " setSourceAndLoad - src: " + src + " type: " + type);

	this.statusTableText(player.id, "Type", type);

	var source = e(player.id + "-source");

	if (source.getAttribute("type") == "" || !this.isMainFeaturePlayer(player))
	{
		source.setAttribute("src", src);
		source.setAttribute("type", type);
		dashjs.MediaPlayerFactory.create(player, source); // Desktop browser support
		player.load();
	}
}

mVid.switchPlayerToPlaying = function(freshPlayer, previousPlayer) { // Deals with transition from previous to new video objects
	// FreshPlayer / previousPlayer can be null

	if (freshPlayer == previousPlayer) {
		this.Log.error("Current and next player are the same (" + freshPlayer.id + ")");
		previousPlayer = null;
	}

	this.Log.info("---------------------------------------------------------------------------------------------------");
	this.Log.info("Start playing called: "); // Logging instruction calls
	if (freshPlayer) {
		this.Log.info(" - freshPlayer: " + freshPlayer.id);
	} else {
		this.Log.warn(" - Not ready to play yet");
	}
	if (previousPlayer) this.Log.info(" - previousPlayer: " + previousPlayer.id)

	// Set the display CSS property of the pre-fetched video to block.
	if (freshPlayer) {
		freshPlayer.style.display = "block";
	}

	// Pause the currently playing media element, using the pause() function.
	if (previousPlayer) {
		previousPlayer.pause();
	}

	// Start playback of the pre-fetched media, using the play() function.
	if (freshPlayer) {
		freshPlayer.playbackRate = 1;
		freshPlayer.play();
	}

	// Set the display CSS property of the previous media element to none.
	if (previousPlayer) {
		previousPlayer.style.display = "none";
	}

	// Purge previous player
	if (previousPlayer && !this.isMainFeaturePlayer(previousPlayer)) {
		this.purgePlayer(previousPlayer.id);
	}
}

mVid.getBufferedAmount = function (player) { // Looks at the video object & works out how much buffering is needed
	var buffer 	= player.buffered;
	var bufferEnd = 0;

	if (buffer.length > 1) {
		this.Log.error(player.id + ": Fragmented buffer, ie multiple buffer fragments. (" + buffer.length + ")");
	}

	if (buffer.length > 0) {
		bufferEnd = buffer.end(buffer.length-1);
	}

	return bufferEnd;
}

mVid.onVideoEvent = function (event) { // The actual event handler
	var bufferingPlayer = mVid.getCurrentBufferingPlayer();
	var playingPlayer = mVid.getCurrentPlayingPlayer();

	var bufferingContentIdx = mVid.getBufferingContentIdx();
	var playingContentIdx = mVid.getPlayingContentIdx();

	var bBufferingWhilstAttemptingToPlay = (bufferingContentIdx === playingContentIdx);

	switch(event.type) {
		case mVid.videoEvents.LOAD_START: // Started loading info
			mVid.Log.info(this.id + ": video has started loading");
			break;

		case mVid.videoEvents.LOADED_METADATA: // It's loaded enough metadata to spit out info
			mVid.Log.info(this.id + ": metadata has loaded");
			mVid.statusTableText(this.id, "Buffer", "Started buffering");
			break;

		case mVid.videoEvents.CAN_PLAY: // Buffered enough to start playing
			mVid.Log.info(this.id + ": video can play");
			mVid.statusTableText(this.id, "Buffer", "Enough to start play");
			break;

		case mVid.videoEvents.CAN_PLAY_THROUGH:
			mVid.Log.info(this.id + ": buffered sufficiently to play-through.");
			mVid.statusTableText(this.id, "Buffer", "Can play through");

			if ((this == playingPlayer) && this.paused) {
        // Happens for first piece of content (or we're behind on buffering) - we can start playing now...
				mVid.switchPlayerToPlaying(this, null);
			}

			break;

		case mVid.videoEvents.PLAY: // Sets the video to play
			mVid.Log.info(this.id + ": video is playing");
			mVid.statusTableText(this.id, "Play", "Playing");
			break;

		case mVid.videoEvents.PAUSE: // Pauses the main content to play the ad
			mVid.Log.info(this.id + ": video is paused");
			mVid.statusTableText(this.id, "Play", "Paused");

			if (mVid.isMainFeaturePlayer(this)) {
				mVid.skipPlayingToNextPlayer();
				var newPlayingPlayer = mVid.getCurrentPlayingPlayer();

				mVid.switchPlayerToPlaying(newPlayingPlayer, this);
			}
			break;

		case mVid.videoEvents.SEEKED:
			mVid.Log.info(this.id + ": video has seeked");
			break;

		case mVid.videoEvents.STALLED: // Sometimes will stall if theres a network issue & logs it
			mVid.Log.warn(this.id + ": has stalled");
			break;

		case mVid.videoEvents.WAITING:
			mVid.Log.warn(this.id + ": is waiting");
			break;

		case mVid.videoEvents.RESIZE:
			mVid.Log.info(this.id + ": resize called");
			break;

		case mVid.videoEvents.ENDED: // When advert comes to an end, requests new video
			mVid.statusTableText(this.id, "Buffer", "---");
			mVid.Log.info(this.id + ": video has ended");

			// Start playing buffered content
			mVid.skipPlayingToNextPlayer();
			var newPlayingPlayer = mVid.getCurrentPlayingPlayer();

			mVid.switchPlayerToPlaying(newPlayingPlayer, this);
			break;

		case mVid.videoEvents.TIME_UPDATE: // Called 5 times a second tracking where playing is & looks to see how far from the end to preload next video object
			mVid.updatePlaybackBar(this.id);

			// Start buffering next programme?
			if (bBufferingWhilstAttemptingToPlay) {
				var duration 	= this.duration;
				var bufferEnd 	= mVid.getBufferedAmount(this);
				var bPreloadNextAd = false;

				if (mVid.isMainFeaturePlayer(playingPlayer)) {
					if ((this.currentTime + PRELOAD_NEXT_AD_S) >= (this.restartPoint + mVid.getTransitionTime(playingPlayer))) {
						bPreloadNextAd = true;
					}
				} else {
					if ((this.currentTime + PRELOAD_NEXT_AD_S) >= duration) {
						bPreloadNextAd = true;
					}
				}

				if (bPreloadNextAd) {
					mVid.statusTableText(this.id, "Buffer", "Buffering complete");
					mVid.Log.info(this.id + ": Content fully buffered");
					mVid.skipBufferingToNextPlayer(); // Get ready to buffer next player
					mVid.setContentSourceAndLoad();
				}
			}

			// Pause main content (to start adverts)?
			if ((this == playingPlayer) && mVid.isMainFeaturePlayer(playingPlayer)) {
				if ((this.currentTime - this.restartPoint) >= mVid.getTransitionTime(playingPlayer)) {
					mVid.Log.info(this.id + ": pause main content, start adverts");
					this.restartPoint = this.currentTime;
					this.pause();
				}
			}
			break;

		case mVid.videoEvents.ERROR:
			mVid.Log.error(this.id + ": video error: " + event.srcElement.error.code);
			break;

		default:
			// Do nothing
  }
};
