var app = require('http').createServer(handler),
	io = require('socket.io').listen(app),
	fs = require('fs'),
	url = require('url');

// start listening
app.listen(8080);

function handler (req, res) {
	
	var pathname = url.parse(req.url).pathname;
	console.log('handling request for '+pathname);
	
	if (pathname == '/') pathname += 'index.html';
	pathname = '/public' + pathname;
	
	fs.readFile(
		__dirname + pathname,
		function (err, data) {
			if (err) {
				res.writeHead(500);
				return res.end('Error loading '+pathname);
			}
			console.log('serving up '+pathname);
			res.writeHead(200);
			res.end(data);
		}
	);

}


// "rooms" are desktop clients
var rooms = [];

function room (roomSocket, roomId) {
	this.roomSocket = roomSocket;
	this.roomId = roomId;
	this.mobileSockets = [];
};

io.sockets.on('connection', function (socket) {

	socket.on("NEW_ROOM", function (data) {
		rooms.push(new room(socket, data.room));
	});

	socket.on("CONNECT_MOBILE", function (data, fn) {
		var desktopRoom = null;
		for (var i = 0; i < rooms.length; i++) {
			if (rooms[i].roomId == data.room) {
				desktopRoom = i;
			}
		}
		if (desktopRoom !== null) {
			rooms[desktopRoom].mobileSockets.push(socket);
			socket.set('roomi', desktopRoom, function() {})
			fn({
				registered: true
			});
			rooms[socket.store.data.roomi].roomSocket.emit('ADD_USER', socket.id, data);
		} else {
			fn({
				registered: false,
				error: "No live desktop connection found"
			});
		}
	});

	//Update the position
	socket.on("UPDATE_ORIENTATION", function(data) {
		console.log('UPDATE_ORIENTATION')
		if (typeof socket.store.data.roomi !== 'undefined') {
			if (typeof rooms[socket.store.data.roomi] !== 'undefined') {
				var r = rooms[socket.store.data.roomi];
					r.roomSocket.emit('UPDATE_ORIENTATION', socket.id, data);
			}
		}
	});

	//Update the position
	socket.on("UPDATE_ACCELERATION", function(data) {
		console.log('UPDATE_ACCELERATION')
		if (typeof socket.store.data.roomi !== 'undefined') {
			if (typeof rooms[socket.store.data.roomi] !== 'undefined') {
				var r = rooms[socket.store.data.roomi];
					r.roomSocket.emit('UPDATE_ACCELERATION', socket.id, data);
			}
		}
	});


	//When a user disconnects
	socket.on("disconnect", function() {
		console.log(rooms.length);
		var destroyThis = null;

		if (typeof socket.store.data.roomi == 'undefined') {
			for (var i in rooms) {
				if (rooms[i].roomSocket.id == socket.id) {
					destroyThis = rooms[i];
				}
			}
			if (destroyThis !== null) {
				rooms.splice(destroyThis, 1);
			}
			console.log(rooms.length);
		} else {
			var roomId = socket.store.data.roomi;
			for (var i in rooms[roomId].mobileSockets) {
				if (rooms[roomId].mobileSockets[i] == socket) {
					destroyThis = i;
				}
			}
			if (destroyThis !== null) {
				rooms[roomId].mobileSockets.splice(destroyThis, 1);
			}
			rooms[roomId].roomSocket.emit('REMOVE_USER', socket.id);
		}
	});
});
