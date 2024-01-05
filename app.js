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

io.on('connection', (socket) => {

    players.push(socket);
    if (players.length >= 2) {
        players.forEach((player) => {
            player.emit('reset', { msg: 'reset' });
            player.emit('start', { msg: 'start' });
        })
    }

    socket.on('disconnect', () => {
        players = players.filter((player) => player.id !== socket.id);
        if (players.length < 2) {
            io.emit('reset', { msg: 'reset' });
            io.emit('pause', { msg: 'pause' });
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
                player.emit('win', { msg: 'win' });
            else
                player.emit('lose', { msg: 'lose' });
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
