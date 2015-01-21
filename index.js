/* jshint node:true, laxcomma:true */

var config  = require('./config.json')
  , cmds    = require('./commands.json')
  , irc     = require('irc')
  , client  = new irc.Client(config.server, config.nick, config.opts)
  , db      = require('diskdb').connect(__dirname, ['hangers']);

var channels = {};

client.addListener('message', function(from, to, message) {
  var split = message.split(/ /);
  var command = split[0];
  var users = channels[to].users;

  if (command === '!hangCount') {
    var requested_person = db.hangers.findOne({name : split[1]});
    var amount = false;
    if (requested_person) amount = requested_person.hangings;
    if (amount) {
      client.say(to, from+': '+split[1]+' has hanged a total of '+amount +' people.');
    } else {
      client.say(to, from+': '+split[1]+' has yet to hang anyone.');
    }
  }

  if (cmds[command]) {
    var res = cmds[command].response;

    if (Object.prototype.toString.call(res) === '[object Array]') {
      res = res[Math.floor(Math.random() * res.length)];
    }

    if (res.indexOf('#{victim}') > -1 && !split[1]) {
      client.say(to, from+': You need a target, fuckface.');
      return;
    }

    if (res.indexOf('#{random}') > -1 && !users) {
      client.say(to, from + config.errors.no_list);
    }

    res = res.replace(new RegExp('#{target}', 'g'), from)
             .replace(new RegExp('#{channel}', 'g'), to)
             .replace(new RegExp('#{victim}', 'g'), split[1])
             .replace(new RegExp('#{random}', 'g'), users[Math.floor(Math.random() * users.length)]);

    if (cmds[command].type === 'me') client.action(to, res);
    else client.say(to, res);

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

client.addListener('names', function(channel, nicks) {
  nicks = Object.getOwnPropertyNames(nicks);
  nicks.splice(nicks.indexOf(client.opt.nick), 1);
  channels[channel] = { users : nicks };
});

client.addListener('ctcp-version', function(from, to, message) {
  client.ctcp(from, 'notice', '\001VERSION RopeKittenBot-v0.0.1\001');
});
