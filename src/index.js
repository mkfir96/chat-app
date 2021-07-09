const express = require("express");
const http = require("http");
const path = require("path");
const socketio = require("socket.io");
const Filter = require("bad-words");
const {
  generateMessage,
  generateLocationMessage,
} = require("./utils/messages");
const {
  addUser,
  getUser,
  getUsersInRoom,
  removeUser,
} = require("./utils/users");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, "../public");
const io = socketio(server);

app.use(express.static(publicDirectoryPath));

io.on("connection", (socket) => {
  console.log("New WebSocket connection");

  socket.on("join", (options, callback) => {
    const {error, user} = addUser({ id: socket.id, ...options })
    
    if (error) {
      return callback(error)
    }

    socket.join(user.room);
    socket.emit("message", generateMessage("ChatBot", "Welcome to our chat!"));
    socket.broadcast
      .to(user.room)
      .emit("message", generateMessage("ChatBot", `${user.username} has joined!`));
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room)
    })
    
    callback()
  });

  socket.on("sendMessage", (message, callback) => {
    const filter = new Filter();
    const user = getUser(socket.id)
    if (message == "") {
      return callback("Forgot to write something?");
    } else if (filter.isProfane(message)) {
      return callback("Please don't use bad words.");
    }

    io.to(user.room).emit("message", generateMessage(user.username, message));
    callback();
  });

  socket.on("sendLocation", (coords, callback) => {
    const user = getUser(socket.id)
    io.to(user.room).emit(
      "locationMessage",
      generateLocationMessage(
        user.username,
        `https://www.google.co.il/maps?q=${coords.latitude},${coords.longitude}`
      )
    );
    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id)
    
    if (user) {
      io.to(user.room).emit("message", generateMessage("ChatBot", `${user.username} has left!`));
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room)
      })
    }
  });
});

server.listen(port, () => {
  console.log("Server is on port " + port + ".");
});
