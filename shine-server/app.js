/* eslint-disable global-require */
const chalk = require('chalk');
const cors = require('cors');
const express = require('express');

const app = express();

const Room = require('./classes/Room');

const rooms = [];

const utils = require('./utils');

module.exports.init = () => {
  app.use(cors());
  const options = {
    cors: {
      origin: 'http://localhost:4200',
    },
  };

  const server = require('http').Server(app);
  const io = require('socket.io')(server, options);

  app.get('/', (req, res) => {
    res.send('Hello World!');
  });

  io.on('connection', (socket) => {
    const handshake = socket.id;

    const game = 'Orejitas';

    console.log(`${chalk.green(`Nuevo dispositivo: ${handshake}`)} entrado al juego ${game}`);

    // create a room
    socket.on('createRoom', (res) => {
    // Emite el mensaje a todos lo miembros de las sala menos a la persona que envia el mensaje
    // Create new Room
      const room = new Room(
        res.data.name,
        res.data.description,
        res.data.maxPlayers,
        res.data.userNickname,
      );

      // Join admin to Room
      // room.join(res.data.userNickname, handshake);

      // Add room to rooms list
      rooms.push(room);

      const roomToJoin = rooms.find((r) => r.id === room.id);
      roomToJoin.join(res.data.userNickname, handshake);

      // Create players info
      const players = roomToJoin.players.map((player, index) => ({
        index,
        nickname: player.name,
      }));

      // console.log(rooms);

      const response = {
        sparkId: 1,
        type: 'response',
        success: true,
        data: {
          createdId: room.id,
          roomdeck: room.roomDeck.length,
          tablecard: null,
        },
      };

      socket.join(room.id);

      console.log(`${chalk.green(`Nuevo dispositivo: ${handshake}`)} entrado a la sala ${room.id}`);

      socket.emit('createRoom', response);
    // socket.in(room.id).emit('createRoom', response);
    });

    // Join room
    socket.on('joinRoom', (res) => {
    // Emite el mensaje a todos lo miembros de las sala menos a la persona que envia el mensaje

      // Search if room exists
      const roomToJoin = rooms.find((room) => room.id === res.data.roomId);

      // Default response
      const response = {
        sparkId: 2,
        type: 'response',
        success: false,
        data: {
          message: 'Room does not exists',
        },
      };

      if (roomToJoin) {
        if (roomToJoin.countPlayers < roomToJoin.maxPlayers) {
        // Join to room
          roomToJoin.join(res.data.nickname, handshake);

          // Create players info
          const players = roomToJoin.players.map((player, index) => ({
            index,
            nickname: player.name,
          }));

          // Add new response data
          response.success = true;
          response.data = {
            roomid: roomToJoin.id,
            name: roomToJoin.name,
            description: roomToJoin.description,
            message: `${res.data.nickname} has joined to room`,
            players,
          };

          socket.join(res.data.roomId);

          console.log(`${chalk.green(`Nuevo dispositivo: ${handshake}`)} entrado a la sala ${roomToJoin.id}`);
        } else {
          response.success = false;
          response.data.message = 'Room is already full';
        }
      }

      // socket.emit('joinRoom', response);
      io.in(res.data.roomId).emit('joinRoom', response);
    });

    // chat para una sala
    socket.on('chatRoom', (res) => {
      const response = {
        sparkId: 3,
        type: 'response',
        success: true,
        data: res.data,
      };

      io.in(res.data.roomId).emit('chatRoom', response);
    });

    // start game
    socket.on('startRoom', async (res) => {
      // room to start game
      const roomToStart = rooms.find((room) => room.id === res.data.roomId);

      // Default response
      const response = {
        sparkId: 4,
        type: 'response',
        success: false,
        data: {
          message: 'Room does not exists',
        },
      };

      let send = false;

      if (roomToStart) {
        if (roomToStart.roomAdmin == res.data.nickname) {
          if (roomToStart.countPlayers == roomToStart.maxPlayers) {
            roomToStart.start = true;
            roomToStart.table_card = null;

            const playersList = roomToStart.players;
            const deckRoom = roomToStart.roomDeck;

            const playerTurn = roomToStart.turnPlayer;

            for (const player in playersList) {
              const hand = [];
              for (let i = 0; i < 5; i++) {
                const card = deckRoom[i];
                hand.push(card);
                deckRoom.splice(deckRoom.indexOf(card), 1);
              }
              playersList[player].cards = hand;
            }

            roomToStart.roomDeck = deckRoom;
            response.success = true;

            for await (const player of playersList) {
              const playersret = [];
              for (const newPlayer of playersList) {
                if (player.socket == newPlayer.socket) {
                  const pl = {
                    name: player.name,
                    socket: player.socket,
                    room: player.room,
                    cards: player.cards,
                    countCards: player.cards.length,
                    turn: player.turn,
                  };
                  playersret.push(pl);
                } else {
                  const pl = {
                    name: newPlayer.name,
                    socket: newPlayer.socket,
                    room: newPlayer.room,
                    cards: null,
                    countCards: newPlayer.cards.length,
                    turn: newPlayer.turn,
                  };
                  playersret.push(pl);
                }
              }
              const data = {
                start: roomToStart.start,
                turnPlayer: { socket: playerTurn.socket, name: playerTurn.name },
                players: playersret,
                roomdeck: roomToStart.roomDeck.length,
                tablecard: roomToStart.table_card,
              };
              response.data = data;
              // console.log('se va a enviar inicio a player---------->', player)
              io.to(player.socket).emit('startRoom', response);
            }
            send = true;
          } else {
            response.success = false;
            response.data = {
              message: 'Waiting players...',
            };
          }
        } else {
          response.success = false;
          response.data = {
            message: 'You are not admin!',
          };
        }
      }

      if (!send) {
        socket.emit('startRoom', response);
      }
    });

    // Take a card
    socket.on('takeCard', async (res) => {
      // Default response
      const response = {
        sparkId: 5,
        type: 'response',
        success: false,
        data: {
          message: 'Room does not exists',
        },
      };

      send = false;
      // room to start game
      const roomGame = rooms.find((room) => room.id === res.data.roomId);

      if (roomGame) {
        const deck = roomGame.roomDeck;
        const playersList = roomGame.players;

        if (deck.length > 0) {
          const newCard = deck[0];

          for (const player in playersList) {
            if (playersList[player].name == res.data.nickname) {
              playersList[player].cards.push(newCard);
              deck.splice(deck.indexOf(newCard), 1);
            }
          }

          for await (const player of playersList) {
            const playersret = [];
            for (const newPlayer of playersList) {
              if (player.socket == newPlayer.socket) {
                const pl = {
                  name: player.name,
                  socket: player.socket,
                  room: player.room,
                  cards: player.cards,
                  countCards: player.cards.length,
                  turn: player.turn,
                };
                playersret.push(pl);
              } else {
                const pl = {
                  name: newPlayer.name,
                  socket: newPlayer.socket,
                  room: newPlayer.room,
                  cards: null,
                  countCards: newPlayer.cards.length,
                  turn: newPlayer.turn,
                };
                playersret.push(pl);
              }
            }
            const data = {
              start: roomGame.start,
              // turnPlayer: playerTurn,
              players: playersret,
              roomdeck: roomGame.roomDeck.length,
              tablecard: roomGame.table_card,
            };
            response.success = true;
            response.data = data;
            // console.log('se va a enviar inicio a player---------->', player)
            io.to(player.socket).emit('takeCard', response);
          }
          send = true;
        } else {
        // Default response
          response.success = false;
          response.data = {
            message: 'Empty deck',
          };
        }
      }

      if (!send) {
        socket.emit('takeCard', response);
      }
    });

    // make a move of cards
    socket.on('makeMove', async (res) => {
    // Default response
      const response = {
        sparkId: 6,
        type: 'response',
        success: false,
        data: {
          message: 'Room does not exists',
        },
      };

      send = false;
      // room to start game
      const roomGame = rooms.find((room) => room.id === res.data.roomId);

      if (roomGame) {
        const playersList = roomGame.players;

        if (roomGame.table_card) {
        // next move and change color
          const playerMove = roomGame.players.find((player) => player.name == res.data.nickname);
          const playerCards = playerMove.cards;

          let ipm = roomGame.players.indexOf(playerMove);

          if (ipm == (roomGame.players.length - 1)) {
            ipm = 0;
          } else {
            ipm += 1;
          }

          const nexPlayer = roomGame.players[ipm];

          playerMove.turn = false;
          nexPlayer.turn = true;

          const rmcard = playerCards.find((c) => c.num == res.data.card.num && c.fig == res.data.card.fig);

          playerCards.splice(playerCards.indexOf(rmcard), 1);
          roomGame.table_card = res.data.card;

          if (res.data.change) {
            const rmcardcolor = playerCards.find((c) => c.num == res.data.change_card.num && c.fig == res.data.change_card.fig);
            playerCards.splice(playerCards.indexOf(rmcardcolor), 1);
            roomGame.table_card = res.data.change_card;
          }
        } else {
          // first move
          const playerMove = roomGame.players.find((player) => player.name == res.data.nickname);
          const playerCards = playerMove.cards;

          let ipm = roomGame.players.indexOf(playerMove);

          if (ipm == (roomGame.players.length - 1)) {
            ipm = 0;
          } else {
            ipm += 1;
          }

          const nexPlayer = roomGame.players[ipm];

          playerMove.turn = false;
          nexPlayer.turn = true;

          const rmcard = playerCards.find((c) => c.num == res.data.card.num && c.fig == res.data.card.fig);

          playerCards.splice(playerCards.indexOf(rmcard), 1);
          roomGame.table_card = res.data.card;
        }

        for await (const player of playersList) {
          const playersret = [];
          for (const newPlayer of playersList) {
            if (player.socket == newPlayer.socket) {
              const pl = {
                name: player.name,
                socket: player.socket,
                room: player.room,
                cards: player.cards,
                countCards: player.cards.length,
                turn: player.turn,
              };
              playersret.push(pl);
            } else {
              const pl = {
                name: newPlayer.name,
                socket: newPlayer.socket,
                room: newPlayer.room,
                cards: null,
                countCards: newPlayer.cards.length,
                turn: newPlayer.turn,
              };
              playersret.push(pl);
            }
          }
          const data = {
            start: roomGame.start,
            players: playersret,
            roomdeck: roomGame.roomDeck.length,
            tablecard: roomGame.table_card,
          };
          response.success = true;
          response.data = data;
          // console.log('se va a enviar inicio a player---------->', player)
          io.to(player.socket).emit('makeMove', response);
        }
        send = true;
      }

      // Emite el mensaje a todos lo miembros de las sala menos a la persona que envia el mensaje
      if (!send) {
        socket.emit('makeMove', response);
      }
    });

    // handler
    socket.on('evento', (res) => {
    // Emite el mensaje a todos lo miembros de las sala menos a la persona que envia el mensaje
      socket.emit(game).emit('evento', res);
    });

    socket.on('disconnect', () => {
      console.log('user disconnected');
    });
  });

  server.listen(5000, () => {
    console.log('\n');
    console.log(`>> Socket listo y escuchando por el puerto: ${chalk.green('5000')}`);
  });
};
