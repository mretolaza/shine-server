const Player = require('./Player');

// Return random ID
const makeId = () => {
  const length = 8;
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i += 1) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

module.exports = class Room {
  constructor(name, description, maxPlayers, admin) {
    this.id = makeId();
    this.name = name;
    this.description = description;
    this.maxPlayers = maxPlayers;
    this.players = [];
    this.admin = admin;
  }

  join(name, socket) {
    const player = new Player(name, socket, this);
    this.players.push(player);

    return player;
  }

  get countPlayers() {
    return this.players.length;
  }
};
