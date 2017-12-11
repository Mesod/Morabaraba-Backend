const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const redis = new require('ioredis')();

server.listen(8081);


io.on('connection', function (socket) {
    console.log(socket.id + ' connected!');
    redis.set(socket.id, '');
    socket.on('register', (data) => {
        redis.set(socket.id, data);
        if (data.random == false) {
            if (data.rivalId) {
                //user knows a friend id
                redis.get(data.rivalId, (err, result) => {
                    if (err) {
                        socket.emit('error', 'user not found!');
                    } else {
                        //starting the game

                        //updating rival status
                        result.rivalId = socket.id;
                        result.isInGame = true;
                        result.isDone = false;
                        result.rivalName = data.playerName;
                        result.turn = true;
                        result.moves = [];
                        redis.set(data.rivalId, result);

                        //updating user status
                        data.isInGame = true;
                        data.isDone = false;
                        data.rivalName = result.playerName;
                        data.turn = false;
                        data.moves = [];
                        redis.set(socket.id, data);

                        //informing users
                        io.to(data.rivalId).emit('info', result);
                        socket.emit('info', data);
                    }
                })
            } else {
                //user wants to share id with a friend
                socket.emit('userId', socket.id);
            }
        } else {
            //user wants to play a random game
            //@TODO: add this code, it will be added on version 0.0.2
        }
    });


    socket.on('move', (data) => {
        userSentInfo(data, socket);
    });

    socket.on('disconnect', () => {
        //inform rival
        redis.get(socket.id, (err, result) => {
            io.to(result.rivalId).emit('error', 'rival disconnected!');
            redis.del(socket.id);
        })
    });
    // io.to(socketId).emit('test','Hi!');
});

async function userSentInfo(data, socket) {
    let rData = await redis.get(socket.id);
    if (rData.turn) {
        redis.get(data.rivalId, (err, result) => {
            if (err) {
                socket.emit('error', 'user not found!')
            } else {
                if (checkMoves(data.moves, data.playerName)) {
                    //user won the game
                    finishGame(result, data, true, socket);
                } else {
                    if (isThereAnyRoomLeft()) {
                        //game continues;

                        //updating rival status
                        result.moves = data.moves;
                        result.turn = true;
                        redis.set(data.rivalId, result);

                        //updating user status
                        data.turn = false;
                        redis.set(socket.id, data);

                        //informing rival
                        io.to(data.rivalId).emit('info', result);

                    } else {
                        //there is no room, game finishes without any winner!
                        finishGame(result, data, false, socket);
                    }
                }
            }
        })
    } else {
        socket.emit('warning', 'it is not your turn!');
    }
}

function finishGame(result, data, winner, socket) {
    //updating rival status
    result.moves = data.moves;
    result.turn = false;
    result.isDone = true;
    result.winner = winner ? data.playerName : 'none';
    redis.set(data.rivalId, result);

    //updating user status
    data.turn = false;
    data.isDone = true;
    data.winner = winner ? data.playerName : 'none';
    redis.set(socket.id, data);

    //informing rival
    io.to(data.rivalId).emit('result', result);
    socket.emit('result', data);
}


let matrix = [];

function checkMoves(moves, playerName) {
    let p = playerName;
    //making a matrix of table
    // global matrix!
    matrix = [];
    for (let i = 0; i < 9; i++) {
        matrix.push('none');
    }
    moves.forEach((item) => {
        matrix[item.place] = item.userName;
    })

    //checking to see if the player wins the game, it just check the player because if is called once a move emitted!
    if ((matrix[0] == p && matrix[1] == p && matrix[2] == p) ||
        (matrix[0] == p && matrix[3] == p && matrix[6] == p) ||
        (matrix[0] == p && matrix[4] == p && matrix[8] == p) ||
        (matrix[1] == p && matrix[4] == p && matrix[7] == p) ||
        (matrix[2] == p && matrix[5] == p && matrix[8] == p) ||
        (matrix[2] == p && matrix[4] == p && matrix[6] == p) ||
        (matrix[3] == p && matrix[4] == p && matrix[5] == p) ||
        (matrix[6] == p && matrix[7] == p && matrix[8] == p)
    ) {
        return true;
    } else {
        return false;
    }
}

function isThereAnyRoomLeft() {
    //check to see if there is any room left!
    let counter = 0;
    matrix.forEach((element) => {
        if (element == "none") {
            counter++;
        }
    })
    if (counter == 0) {
        return false;
    } else {
        return ture;
    }
}

