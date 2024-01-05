const socket = io();
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const pattern = {
    1: [[0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]],
    2: [[0, 0, 2],
        [2, 2, 2],
        [0, 0, 0]],
    3: [[3, 3],
        [3, 3]],
    4: [[0, 4, 4],
        [4, 4, 0],
        [0, 0, 0]],
    5: [[0, 5, 0],
        [5, 5, 5],
        [0, 0, 0]],
    6: [[6, 6, 0],
        [0, 6, 6],
        [0, 0, 0]],
    7: [[7, 0, 0],
        [7, 7, 7],
        [0, 0, 0]]
};
let board = Array.from(Array(20), () => new Array(10).fill(0));
let opponent_board = Array.from(Array(20), () => new Array(10).fill(0));
let Pause = false;
let Intervals = [];
let active_block;
let opponent_active_block;
let score = 0;
let opponent_score = 0;
let drag_x;
let drag_y;
let garbage_count = 0;
let opponent_garbage_count = 0;
let time = new Date();
let state = 'waiting';
let delta = 250;

function get_time() {
    let now = new Date();
    return (now - time) / 1000;
}


function is_GameOver() {
    for (let layer = 0; layer < 4; layer++) {
        for (let i = 0; i < 10; i++) {
            if (board[layer][i] !== 0)
                return true;
        }
    }
    return false;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

function Block(id) {
    this.id = id;
    this.pattern = pattern[id];
    this.offset_i = 0;
    this.offset_j = 3;
    this.is_valid = function () {
        for (let i = 0; i < this.pattern.length; i++) {
            for (let j = 0; j < this.pattern[0].length; j++) {
                if (this.pattern[i][j] === 0)
                    continue;
                let actual_i = i + this.offset_i;
                let actual_j = j + this.offset_j;
                if (actual_i < 0 || actual_i >= 20 || actual_j < 0 || actual_j >= 10)
                    return false;
                if (board[actual_i][actual_j] !== 0)
                    return false;
            }
        }
        return true;
    }
    this.touch_down = function () {
        for (let i = 0; i < this.pattern.length; i++) {
            for (let j = 0; j < this.pattern[0].length; j++) {
                if (this.pattern[i][j] === 0)
                    continue;
                let actual_i = i + this.offset_i;
                let actual_j = j + this.offset_j;
                if (actual_i === 19)
                    return true;
                if (board[actual_i + 1][actual_j] !== 0)
                    return true;
            }
        }
        return false;
    }
    this.rotate = function () {
        let new_pattern = Array.from(Array(this.pattern.length), () => new Array(this.pattern[0].length).fill(0));
        for (let i = 0; i < this.pattern.length; i++) {
            for (let j = 0; j < this.pattern[0].length; j++) {
                new_pattern[i][j] = this.pattern[this.pattern.length - 1 - j][i];
            }
        }
        [new_pattern, this.pattern] = [this.pattern, new_pattern];
        if (!this.is_valid()) {
            this.pattern = new_pattern;
        }
    }
    this.move_left = function () {
        this.offset_j--;
        if (!this.is_valid())
            this.offset_j++;
    }
    this.move_right = function () {
        this.offset_j++;
        if (!this.is_valid())
            this.offset_j--;
    }
    this.move_down = function () {
        this.offset_i++;
        if (!this.is_valid())
            this.offset_i--;
    }
}

function add_new_block() {
    let id = getRandomInt(1, 8);
    active_block = new Block(id);
}

function clear_board() {
    let cnt = 0;
    const add_score = [0, 100, 300, 700, 1500];
    for (let times = 0; times < 4; times++) {
        for (let i = 0; i < 20; i++) {
            let is_full = true;
            for (let j = 0; j < 10; j++) {
                if (board[i][j] === 0) {
                    is_full = false;
                    break;
                }
            }
            if (is_full) {
                for (let j = i; j > 0; j--) {
                    for (let k = 0; k < 10; k++) {
                        board[j][k] = board[j - 1][k];
                    }
                }
                cnt++;
            }
        }
    }
    score += add_score[cnt];
    if (cnt > 0) {
        socket.emit('send_garbage', {count: cnt});
        garbage_count = Math.max(garbage_count - Math.max(0, Math.floor(cnt / 2)), 0);
    }

}

function add_garbage() {
    for (let i = 0; i < garbage_count; i++) {
        let space = getRandomInt(0, 10);
        for (let j = 0; j < 10; j++) {
            for (let k = 1; k < 20; k++) {
                board[k - 1][j] = board[k][j];
            }
            board[19][j] = 0;

            if (space === j)
                continue;
            board[19][j] = 8;
        }
    }
    garbage_count = 0;
}

function move_down_active_block() {
    let is_touch = false;
    if (active_block.touch_down()) {
        is_touch = true;
        for (let i = 0; i < active_block.pattern.length; i++) {
            for (let j = 0; j < active_block.pattern[0].length; j++) {
                if (active_block.pattern[i][j] === 0)
                    continue;
                board[i + active_block.offset_i][j + active_block.offset_j] = active_block.id;
            }
        }
        if (is_GameOver()) {
            active_block = null;
            socket.emit('end', {msg: 'end'});
            return;
        }
        clear_board();
        add_new_block();
    }
    active_block.move_down();
    if (is_touch) {
        add_garbage();
        clear_intervals();
        set_intervals();
    }

    if (!active_block.is_valid())
        active_block.offset_i--;

}

function clear_canvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
}

function draw_background() {
    context.fillStyle = 'rgba(205, 245, 253, 1)';
    context.fillRect(0, 0, canvas.width/2, canvas.height);
    context.fillStyle = 'rgb(92,223,255, 0.3)';
    context.fillRect(canvas.width/2, 0, canvas.width/2, canvas.height);
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.fillRect(350-delta, 50, 300, 600);
    context.fillRect(350+delta, 50, 300, 600);
}

function draw_score(score,delta) {
    context.fillStyle = "rgb(0,0,0,0.25)";
    context.font = "bold 40px 'Noto Serif'";
    let digit = score.toString().length + 8;
    context.fillText("Score : " + score, 500 - digit * 10 - delta, 350);
}

function draw_grid() {
    const grid_size = 30;

    context.strokeStyle = "rgba(160, 233, 255, 0.3)";
    context.lineWidth = 1.5;
    for (let i = 1; i < 20; i++) {
        context.beginPath();
        context.moveTo(350 -delta, 50 + i * grid_size);
        context.lineTo(650 - delta, 50 + i * grid_size);
        context.closePath();
        context.stroke();
        context.beginPath();
        context.moveTo(350 + delta, 50 + i * grid_size);
        context.lineTo(650+ delta, 50 + i * grid_size);
        context.closePath();
        context.stroke();
    }
    for (let i = 1; i < 10; i++) {
        context.beginPath();
        context.moveTo(350 + i * grid_size-delta, 50);
        context.lineTo(350 + i * grid_size-delta, 650);
        context.closePath();
        context.stroke();
        context.beginPath();
        context.moveTo(350 + i * grid_size+delta, 50);
        context.lineTo(350 + i * grid_size+delta, 650);
        context.closePath();
        context.stroke();
    }

    context.strokeStyle = "rgb(0,0,0)";
    context.beginPath();
    context.moveTo(350-delta, 50);
    context.lineTo(350-delta, 650);
    context.lineTo(650-delta, 650);
    context.lineTo(650-delta, 50);
    context.stroke();
    context.beginPath();
    context.moveTo(350+delta, 50);
    context.lineTo(350+delta, 650);
    context.lineTo(650+delta, 650);
    context.lineTo(650+delta, 50);
    context.stroke();
}

function draw_game_board(game_board,delta) {
    const color = {
        1: "rgb(62, 219, 161)",
        2: "rgb(219, 121, 61)",
        3: "rgb(219, 187, 62)",
        4: "rgb(161, 219, 62)",
        5: "rgb(204, 78, 191)",
        6: "rgb(255, 55, 80)",
        7: "rgb(93, 77, 255)",
        8: "rgb(121, 118, 118)"
    };
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 10; j++) {
            if (game_board[i][j] !== 0) {
                context.fillStyle = color[game_board[i][j]];
                context.fillRect(350 + j * 30+delta, 50 + i * 30, 30, 30);
                context.strokeStyle = "rgb(0,0,0)";
                context.strokeWidth = 1.5;
                context.strokeRect(350 + j * 30+delta, 50 + i * 30, 30, 30);
                context.strokeStyle = "rgba(0,0,0,0.15)";
                context.strokeRect(357.5 + j * 30+delta, 57.5 + i * 30, 15, 15);
            }
        }
    }
}

function draw_active_block(active_block,delta) {
    const color = {
        1: "rgb(62, 219, 161)",
        2: "rgb(219, 121, 61)",
        3: "rgb(219, 187, 62)",
        4: "rgb(161, 219, 62)",
        5: "rgb(204, 78, 191)",
        6: "rgb(255, 55, 80)",
        7: "rgb(93, 77, 255)"
    };
    if (!active_block)
        return;
    for (let j = 0; j < active_block.pattern.length; j++) {
        for (let k = 0; k < active_block.pattern[0].length; k++) {
            if (active_block.pattern[j][k] === 0)
                continue;
            context.fillStyle = color[active_block.id];
            context.fillRect(350 + (k + active_block.offset_j) * 30 - delta, 50 + (j + active_block.offset_i) * 30, 30, 30);
            context.strokeStyle = "rgb(0,0,0)";
            context.lineWidth = 1.5;
            context.strokeRect(350 + (k + active_block.offset_j) * 30- delta, 50 + (j + active_block.offset_i) * 30, 30, 30);
            context.strokeStyle = "rgba(0,0,0,0.15)";
            context.lineWidth = 1.5;
            context.strokeRect(357.5 + (k + active_block.offset_j) * 30 - delta, 57.5 + (j + active_block.offset_i) * 30, 15, 15);
        }
    }
}

function draw_death_line() {
    context.strokeStyle = "rgb(255,0,0)";
    context.strokeWidth = 1.5;
    context.beginPath();
    context.moveTo(350-delta, 170);
    context.lineTo(650-delta, 170);
    context.stroke();
    context.beginPath();
    context.moveTo(350+delta, 170);
    context.lineTo(650+delta, 170);
    context.stroke();
}

function draw_garbage_pile(garbage_count, delta) {
    context.fillStyle = "rgba(0, 0, 0, 0.3)";
    context.fillRect(310-delta, 50, 25, 600);
    context.fillStyle = "rgb(211,145,145)";
    context.fillRect(310-delta, 650 - garbage_count * 30, 25, garbage_count * 30);
    context.strokeStyle = "rgb(0,0,0)";
    context.strokeWidth = 1.5;
    context.beginPath();
    context.moveTo(310-delta, 50);
    context.lineTo(310-delta, 650);
    context.lineTo(335-delta, 650);
    context.lineTo(335-delta, 50);
    context.stroke();
}

function draw_waiting() {
    context.fillStyle = "rgb(0,0,0)";
    context.font = "bold 40px 'Noto Serif'";
    let t = Math.floor(get_time()+1) % 3;
    context.fillText("Waiting for other players" + (t === 0 ? "." : (t === 1 ? ".." : "...")) , 200, 350);
}

function update_canvas() {
    if (state === "waiting") {
        clear_canvas();
        draw_waiting();
    }
    if (state === "start") {
        clear_canvas();
        draw_background();
        draw_score(score, delta);
        draw_score(opponent_score, -delta);
        draw_grid();
        draw_game_board(opponent_board,delta);
        draw_game_board(board,-delta);
        draw_active_block(active_block,delta);
        draw_active_block(opponent_active_block,-delta);
        draw_death_line();
        draw_garbage_pile(opponent_garbage_count, -delta);
        draw_garbage_pile(garbage_count, delta);
    }
    socket.emit('draw', { board: board, score: score, garbage_count: garbage_count, active_block: active_block });
    requestAnimationFrame(update_canvas);
}

function init_variables() {
    board = Array.from(Array(20), () => new Array(10).fill(0));
    Pause = false;
    Intervals = [];
    active_block = null;
    drag_x = 0;
    drag_y = 0;
    score = 0;
    garbage_count = 0;
    state = "waiting";
    opponent_board= Array.from(Array(20), () => new Array(10).fill(0));
    opponent_garbage_count = 0;
    opponent_score = 0;
    opponent_active_block = null;
    time = new Date();
}

function set_intervals() {
    let level = Math.floor(get_time() / Math.floor(10 + get_time() / 25));
    let speed = Math.max(Math.floor(Math.pow(0.8 - level * 0.007, level) * 1000), 30);
    Intervals.push(setInterval(move_down_active_block, speed));
}

function clear_intervals() {
    for (let i = 0; i < Intervals.length; i++) {
        clearInterval(Intervals[i]);
    }
    Intervals = [];
}


function reset_game() {
    clear_intervals();
    init_variables();
    add_new_block();
    set_intervals();
}

function pause_game() {
    if (Pause)
        return;
    clear_intervals();
    Pause = true;
}

requestAnimationFrame(update_canvas);

document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a") {
        if (Pause)
            return;
        active_block.move_left();
    }
    if (event.key === "ArrowRight" || event.key === "d") {
        if (Pause)
            return;
        active_block.move_right();
    }
    if (event.key === "ArrowUp" || event.key === "w") {
        if (Pause)
            return;
        active_block.rotate();
    }
    if (event.key === "ArrowDown" || event.key === "s") {
        if (Pause)
            return;
        active_block.move_down();
    }
    if (event.key === " " || event.code === "Space") {
        if (Pause)
            return;
        for (let i = 0; i < 20; i++)
            active_block.move_down();
        move_down_active_block();
        clear_intervals();
        set_intervals();
    }
})


//reset_game();
pause_game();


socket.on('start', (msg) => {
    reset_game();
    state = "start";
    time = new Date();
});

socket.on('pause', (msg) => {
    pause_game();
})

socket.on('send_garbage', (msg) => {
    garbage_count += msg.count;
})

socket.on('win', (msg) => {
    pause_game();
    alert('You win!');
})

socket.on('lose', (msg) => {
    pause_game();
    alert('You lose!');
})

socket.on('draw', (msg) => {
    opponent_board = msg.board;
    opponent_score = msg.score;
    opponent_garbage_count = msg.garbage_count;
    opponent_active_block = msg.active_block;
})


