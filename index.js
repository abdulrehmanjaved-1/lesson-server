"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const httpServer = http_1.createServer();
const https = require("https");
const readline = require('readline');

const _host = "api.apix.limnu.com";  // The limnu base address
const _port = "443";            // SSL
const _basePath = "/v1/";       // The API version number
const _apiKey = "K_xG3LYQcXQzyJTieL05YYEwLdqg59um";  // Replace this with your API key

const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },

});


let roomsObj = {};


io.on("connection", (socket) => {
    console.log(`${socket.id} connected`);

    socket.on('fetch-rooms', (data) => {
	socket.emit('fetch-rooms', roomsObj);		    	
	socket.on('disconnect', () => {
		console.log(`${socket.id} fetch rooms disconnected`);
	});
    });

    socket.on('join-room', (data) => {
	console.log('got join room method');
        if (!data.room) {
	    console.log("No Room");
	    socket.emit('room-not-found');		    
            return;
        }
        const connectedSockets = io.of("/").adapter.rooms.get(data.room);
        if (connectedSockets && connectedSockets.size > 1) {
	    socket.emit('room-full');		    	
	    console.log("Room is full");
            return;
        }

	if(!roomsObj[data.room]) {
		roomsObj[data.room] = data;
		socket.is_teacher = data.is_teacher;
	}

        socket.join(data.room);
        console.log(`${socket.id} connected to room ${data.room}`);
        socket.to(data.room).emit('peer-connected');
        socket.on('disconnect', () => {
            console.log(`${socket.id} disconnected socket.is_teacher ${socket.is_teacher}`);
            socket.to(data.room).emit('peer-disconnected');
	    if(socket.is_teacher) {
		if(roomsObj[data.room]) {
			delete roomsObj[data.room];
		}
	    }
        });
    });

    socket.on('offer', (data) => {
        if (!data.room) {
            return;
        }
        console.log(`${socket.id} emitting offer`);
        socket.to(data.room).emit('offer', data);
    });

    socket.on('answer', (data) => {
        if (!data.room) {
            return;
        }
        console.log(`${socket.id} emitting answer`);
        socket.to(data.room).emit('answer', data);
    });

    socket.on('candidate', (data) => {
        if (!data.room) {
            return;
        }
        console.log(`${socket.id} emitting ice-candidate`);
        socket.to(data.room).emit('candidate', data);  
    });

    socket.on('start-whiteboard', async (data) => {
        if (!data.room) {
            return;
        }
        if(!data.url) { // If we already have url don't create again
            let url = await fetchWhiteboardUrl(data);
	    if(!url) {
		socket.emit('start-whiteboard-failed', data); 
		return;
	    }
            data.url = url;
            // Make sure update to self as well
            socket.emit('start-whiteboard', data);  // Sending to Self 
        }
        console.log(`${socket.id} emitting start whiteboard`);
        socket.to(data.room).emit('start-whiteboard', data);  
    });
    
    socket.on('stop-whiteboard', (data) => {
        if (!data.room) {
            return;
        }
        console.log(`${socket.id} emitting stop whiteboard`);
        socket.to(data.room).emit('stop-whiteboard', data);  
    });

    socket.on('mute-audio', (data) => {
        if (!data.room) {
            return;
        }
        console.log(`${socket.id} emitting mute-audio`);
        socket.to(data.room).emit('mute-audio', data);  
    });

     socket.on('block-video', (data) => {
        if (!data.room) {
            return;
        }
        console.log(`${socket.id} emitting mute-audio`);
        socket.to(data.room).emit('block-video', data);  
    });

    socket.on('chat', (data) => {
        if (!data.room) {
            return;
        }
        console.log(`${socket.id} emitting chat message`);
        socket.to(data.room).emit('chat', data);
    });
});

httpServer.listen(config_1.PORT, () => console.log(`Server listening on port ${config_1.PORT}`));

async function postData(path, requestData)
{
  return new Promise(function(resolve,reject) {

    console.log(`Making a request to https://${_host}:${_basePath}${path} with data ${JSON.stringify(requestData)}`);

    let req = https.request({
      host:    _host,
      port:    _port,
      path:    _basePath + path,
      method:  "POST",
      headers: {
        'Content-Type': 'application/json',
      }
    }, function (res) {

      let chunks = [];

      res.on("data", function (data) {
        console.log("Success calling " + path);
        console.log("response data = " + data);
        chunks.push(data);
      });

      res.on("end", function(){
         const httpString = Buffer.concat(chunks).toString("utf-8");
         const resultObj = JSON.parse(httpString);
         resolve(resultObj);
      });
    });

    let fullData = {
      ...requestData,
      apiKey: _apiKey
    };
    let jsonFull = JSON.stringify(fullData);
    req.write(jsonFull);
    req.on("error", function (err) {
      console.log("Error: " + err);
      reject(err);
    });
    req.end();
  })
}

async function fetchWhiteboardUrl(data)
{
	try {
  console.log("fetchWhiteboardUrl");

  if(!data.name) {
      data.name = "Test";
  }

 console.log('before ' + new Date());

  // Create a new board
  let boardResult = await postData("boardCreate", {"boardName": data.name + " Board", "whiteLabel": true});

 console.log('after boardResult ' + new Date());
	
console.dir(boardResult);

  // Createa a new user
  let userResult = await postData("userCreate", {"displayName": data.name, "whitelabel": true});

   console.log('after userResult ' + new Date());	

console.dir(userResult);

  // Go to this URL in a browser (or an iframe on your site). This will associate the board with this user.
  let testURL = boardResult.boardUrl + "t=" + userResult.token;

  console.log("------------------------------");
  console.log("testURL = " + testURL);
  return testURL;
	} catch(e) {
		console.log('exception in fetchWhiteboardUrl ' + e);
	}

	return null;
}
