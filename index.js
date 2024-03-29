var app = require('express')();
var cookie = require('cookie');
var cookieParser = require('cookie-parser');
var http = require('http').Server(app);
var io = require('socket.io')(http);

//Databases.
var redis   = require("redis"),
    rClient = redis.createClient();
var Mysql   = require('mysql');
var mysql	= Mysql.createConnection({
	host : 'localhost',
	database: 'twothousand',
	user : 'twothousand',
	password: 'TT99!!!'
});


var connectedUsers = {};//this will hold all users who are currently connected.

app.get('/', function(req, res){
	res.sendfile('index.html');
});
/*
io.use(function(socket,next){
	var data = socket.request;
	if(!data.headers.cookie) {		
		return next('No Cookies', false);
	}

	cookieParser(data, {}, function(parseErr) {
		if(parseErr) {
			console.log('test');
			return next('Error parsing cookies', false);
		}
		var dirtytalk = data.cookies['dirtytalk'];
		console.log(dirtytalk);
	});

});
*/

io.on('connection', function(socket){
	//Note, the handshake objects lets us grab the laravel session id.
	cookies = cookie.parse(socket.handshake.headers.cookie);
	if(cookies.dirtytalk) {
		socket.handshake.sess = cookies.dirtytalk;//just store that stuff.
		//use the session id to figure out who this is.
		rClient.get(cookies.dirtytalk,function(err,reply) {
			if(reply) {
				socket.handshake.user = JSON.parse(reply);
				connectedUsers[socket.handshake.user.username] = socket;//this saves the socket so we can refer to it globally.
			} else {
				return false;
			}
		});
	} else {
		return false;
	}

	//private message.
	socket.on('private', function(data) {
		/*
			data should contain 3 things, user_id, username, and message
			data = {
				to_id: integer,
				to: string,
				message: string
			}
		*/

		var me    =	socket.handshake.user.username;
		var me_id = socket.handshake.user.id;

		//We should probably do a "to" and "to_id" match here.  That would be one clever way to get past some stuff.
		check_mutual(data.to_id, me_id,function() {//1. Check to make sure you're allowed to send a message to this user via SQL.
			//2. check to make sure that the user is connected via sockets.
			if(data.to in connectedUsers) {
				//3. send the message to that user if they're connected.
				connectedUsers[data.to].emit('private', {username: me, user_id: me_id, message: data.message});
			}
			//4. store the sent message in mongo.
			store_message(me_id, me, data);
		});

	});

});


//note, to/from should use the username.
function check_mutual(to, from, callback) {//To is a string, from is an integer
	//console.log('to: '+ to);
	//console.log('from: '+ from);

	//Find the ID for To
	//var to_id = find_user(to);

	//MySQL voodoo to check to see if they are mutual.
	follows(to, from,function(result) {
		if(result) {
			follows(from, to, function(result){
				if(result) {
					callback();
				} else {
					return false;
				}
			})
		}
	});
}


function find_user(username) {
	sql = 'SELECT id FROM users WHERE username = ' + mysql.escape(username);
	mysql.query(sql, function(err, results) {
		console.log(results);
		return results[0].id;
	});
}

function follows(id1, id2, callback) {
	sql = 'SELECT count(*) FROM follows WHERE user_id = ' + mysql.escape(parseInt(id1)) + ' AND follower_id = ' + mysql.escape(parseInt(id2));
	mysql.query(sql, function(err, results) {
		if(err) {
			console.log(err);
			callback(false);
		} else {
			if(results[0]['count(*)']) {
				callback(true);
			}
		}
	});
}

function store_message(me_id, me, data) {
	//Do some magic mongo stuff.
	return true;
}


http.listen(3000, function(){
	console.log('listening on *:3000');
});

