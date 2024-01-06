import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';

const app = express();
let players = [];

const server = createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {}
});

const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(express.static(join(__dirname, './tetris')));

app.get('/', (req, res) => {
    if (players.length > 2)
        res.sendFile(join(__dirname, 'waiting.html'));
    else
        res.sendFile(join(__dirname, 'index.html'));
});

app.get('/waiting', (req, res) => {
    res.sendFile(join(__dirname, 'waiting.html'));
})

io.on('connection', (socket) => {

    if (players.length === 2) {
        socket.emit('redirect', { msg: 'redirect' });
        return;
    }
    else
        players.push(socket);
    if (players.length === 2) {
        players.forEach((player) => {
            player.emit('start', { msg: 'start' });
        })
    }

    socket.on('disconnect', () => {
        players = players.filter((player) => player.id !== socket.id);
        // console.log(players.length);
        if(players.length < 2) {
            players.forEach((player) => {
                player.emit('win', 'Opponent disconnected OAO!!!\nYou win' );
                player.emit('reset', { msg: 'reset' });
            })
        }
    })

    socket.on('send_garbage', (msg) => {
        players.forEach((player) => {
            if (player.id !== socket.id)
                player.emit('send_garbage', { count: msg.count });
        })
    })

    socket.on('end', (msg) => {
        players.forEach((player) => {
            if (player.id !== socket.id)
                player.emit('win', 'You win' );
            else
                player.emit('lose', 'You lose' );
        })
    })

    socket.on('draw', (msg) => {
        players.forEach((player) => {
            if (player.id !== socket.id)
                player.emit('draw', msg);
        })
    })
});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});
