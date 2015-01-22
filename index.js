/* jshint node:true, laxcomma:true */

var config  = require('./config.json')
  , cmds    = require('./commands.json')
  , irc     = require('irc')
  , client  = new irc.Client(config.server, config.nick, config.opts)
  , db      = require('diskdb').connect(__dirname, ['hangers'])
  , channels = {};

// If the config has a non-null value for identPass, identify with the server.
if (config.identPass !== null) {
  client.addListener('registered', function(message) {
    client.say('nickserv', 'identify '+config.identPass);
  });
}

/**
 * Whenever the server sends the room nicklist to the bot, save it
 * for use with commands that pick a random person.
 */
client.addListener('names', function(channel, nicks) {
  nicks = Object.getOwnPropertyNames(nicks);
  nicks.splice(nicks.indexOf(client.opt.nick), 1);
  channels[channel] = { users : nicks };
});

//Respond to VERSION requests like a good bot.
client.addListener('ctcp-version', function(from, to, message) {
  client.ctcp(from, 'notice', '\001VERSION '+config.bot.name+'-v'+config.bot.version+'\001');
});

client.addListener('message', function(from, to, message) {
   // Split the incoming message into an array and set the first word
   // as the command variable's value. Also set a users variable as a shorthand.
  var split = message.split(/ /)
    , command = split[0]
    , users = (channels[to] ? channels[to].users : null);

  if (command === '!hangCount') {
    //If the hang count is requested without a valid target, error.
    if (!split[1]) {
      client.say(config.errors.no_target); return;
    } else {
      var requestedPerson = db.hangers.findOne({name : split[1]});
      var amount = false;
      if (requestedPerson) {
        amount = requestedPerson.hangings;
      }
      if (amount) {
        client.say(to, from+': '+split[1]+' has hanged a total of '+amount +' people.');
      } else {
        client.say(to, from+': '+split[1]+' has yet to hang anyone.');
      }
    }
  }

  if (cmds[command]) {
    //Shorthand variable.
    var res = cmds[command].response;

    //If the command has multiple valid responses, pick one at random.
    if (typeOf(res) === '[object Array]') {
      res = res[getRandom(res)];
    }

    //If the command requires a victim and no victim was given, error.
    if (res.indexOf('#{victim}') > -1 && !split[1]) {
      client.say(to, from+config.errors.no_target); return;
    }

    //If the command has a random target but the userlist is not loaded, error.
    if (res.indexOf('#{random}') > -1 && !users) {
      client.say(to, from + config.errors.no_list);
    }

    //Replace all the variables in the response string with their valid values.
    res = res.replace(new RegExp('#{target}', 'g'), from)
             .replace(new RegExp('#{channel}', 'g'), to)
             .replace(new RegExp('#{victim}', 'g'), split[1])
             .replace(new RegExp('#{random}', 'g'), users[getRandom(users)]);

    //Ensure it sends /me or /say as it's supposed to.
    if (cmds[command].type === 'me') {
      client.action(to, res);
    } else {
      client.say(to, res);
    }

  }
});

client.addListener('action', function(from, to, message) {

  if (message.split(/ /)[0] === 'hangs') {

    var hanger = db.hangers.findOne({name : from});

    if (typeof hanger !== 'undefined') {
     db.hangers.update({name : from}, {hangings : hanger.hangings + 1});

    } else {
      db.hangers.save({name : from, hangings : 1});
    }

  }

});

//Shorthand functions
function getRandom(target) {
  return Math.floor(Math.random() * target.length);
}

function typeOf(obj) {
  return Object.prototype.toString.call(obj);
}
