
    var winston = require('winston'),
            fs = require('fs'),
            yaml = require('js-yaml'),
            coin = require('node-dogecoindark');
    var Twitter = require('twitter');
    // check if the config file exists
if(!fs.existsSync('./config/config.yml')) {
        winston.error('Configuration file doesn\'t exist! Please read the README.md file first.');
        process.exit(1);
    }
    // load settings
   var settings = yaml.load(fs.readFileSync('./config/config.yml', 'utf-8'));
    // load winston's cli defaults
    winston.cli();
    // write logs to file
    if (settings.log.file) {
        winston.add(winston.transports.File, {
            filename: settings.file,
            level: 'debug'});
    }
    // connect to coin json-rpc
    winston.info('Connecting to coind...');
    var coin = coin({
        host: settings.rpc.host,
        port: settings.rpc.port,
        user: settings.rpc.user,
        pass: settings.rpc.pass
    });
    // checking if we are connected.
     
    coin.getBalance(function (err, balance) {
        if (err) {
            winston.error('Could not connect to %s RPC API! ', settings.coin.full_name, err);
            process.exit(1);
            return;
        }
        var balance = typeof (balance) == 'object' ? balance.result : balance;
        winston.info('Connected to JSON RPC API. Current total balance is %d' + settings.coin.short_name, balance);
    });
     
    // connect to twitter
    winston.info('Connecting to Twitter');
    var client = new Twitter({
        consumer_key: settings.twitter.consumer_key,
        consumer_secret: settings.twitter.consumer_secret,
        access_token_key: settings.twitter.access_token_key,
        access_token_secret: settings.twitter.access_token_secret
    });
     
    // basic handlers
    var locks = [];
     
    function makeid()
    {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (var i = 0; i < 5;)
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        return text;
    }
     
     
    function replytweet(to, replyid, themessage) {
        winston.info('Preparing tweet' + '@' + to + ' :' + themessage);
        var newtweet = '@' + to + ' ' + themessage + '(' + makeid() + ')';
        winston.info('' + '@' + to + ' :' + newtweet);
        //client.post('statuses/update', {status: newtweet, in_reply_to_status_id: replyid}, function (error, params, response) {
        client.post('direct_messages/new', {text: newtweet, user_id: replyid}, function (error, params, response) {
            if (error) {
                console.log(error);
                //throw error;
            }
     
            console.log('Sending..');
        });
    }
     
    function getAddress(nickname, callback) {
        winston.debug('Requesting address for %s', nickname);
        coin.send('getaccountaddress', settings.rpc.prefix + nickname.toLowerCase(), function (err, address) {
            if (err) {
                winston.error('Something went wrong while getting address. ' + err);
                callback(err);
                return false;
            }
            callback(false, address);
        });
    }
    String.prototype.expand = function (values) {
        var global = {
            nick: 'client.nick'
        }
        return this.replace(/%([a-zA-Z_]+)%/g, function (str, variable) {
            return typeof (values[variable]) == 'undefined' ?
                    (typeof (settings.coin[variable]) == 'undefined' ?
                            (typeof (global[variable]) == 'undefined' ?
                                    str : global[variable]) : settings.coin[variable]) : values[variable];
        });
    }
    client.stream('user', function (stream) {
		stream.on('data', function (data) {
			console.log(data);
 		});   
    })
    client.stream('statuses/filter', {track: 'dogedtip'}, function (stream) {
        stream.on('data', function (tweet) {
            //var match = tweet.text.match(/(dogedtip)(\s)([a-zA-Z]+)(\s)(.+)(\s)([0-9]+)/);
            var match = tweet.text.match(/(dogedtip)(\s)([a-zA-Z]+)/i);
            if (match == null)
                return;
            var command = match[3];
            var sender = tweet.user.screen_name; 
            var msg = tweet.txt;
            var message = tweet.text;
            var replyid = tweet.id_str;
            console.log('@'+ tweet.user.sreen_name + '|' + tweet.text);
    // check if the sending user is logged in (identified) with nickserv
            switch (command) {
                case 'tip':
                    var match = tweet.text.match(/(darktipperbot)(\s)([a-zA-Z]+)(\s)(\@)(.+)(\s)([0-9]+)/i);
                    console.log('tip');
                    console.log(match[0] + ',' + match[1] + ',' + match[2] + ',' + match[3] + ',' + match[4] + ',' + match[5] + ',' + match[6] + ',' + match[7] + ',' + match[8]);
                    if (match == null || match.length < 3) {
                        replytweet(sender, replyid, 'Usage: @DarkTipperBot tip <twitterhandle> <amount>')
                        return;
                    }
                    //if (match[4] !== '@'){ return;}
                    var to = match[6];
                    var amount = Number(match[8]);
     
                    console.log('To:' + amount);
                    // lock
                    if (locks.hasOwnProperty(sender.toLowerCase()) && locks[sender.toLowerCase()])
                        return;
                    locks[sender.toLowerCase()] = true;
     
                    if (isNaN(amount)) {
                        locks[sender.toLowerCase()] = null;
                        replytweet(sender, replyid, settings.messages.invalid_amount.expand({name: sender, amount: match[8]}));
                        return;
                    }
     
                    if (to.toLowerCase() == sender.toLowerCase()) {
                        locks[sender.toLowerCase()] = null;
                        replytweet(sender, replyid, settings.messages.tip_self.expand({name: sender}));
                        return;
                    }
                    if (amount < settings.coin.min_tip) {
                        locks[sender.toLowerCase()] = null;
                        replytweet(sender, replyid, settings.messages.tip_too_small.expand({sender: sender, to: to, amount: amount}));
                        return;
                    }
    // check balance with min. 5 confirmations
                    coin.getBalance(settings.rpc.prefix + sender.toLowerCase(), settings.coin.min_confirmations, function (err, balance) {
                        if (err) {
                            locks[sender.toLowerCase()] = null;
                            winston.error('Error in !tip command.', err);
     
                            replytweet(sender, replyid, settings.messages.error.expand({name: sender}));
                            return;
                        }
                        var balance = typeof (balance) == 'object' ? balance.result : balance;
                        if (balance >= amount) {
                            coin.send('move', settings.rpc.prefix + sender.toLowerCase(), settings.rpc.prefix + to.toLowerCase(), amount, function (err, reply) {
                                locks[sender.toLowerCase()] = null;
                                if (err || !reply) {
                                    winston.error('Error in !tip command', err);
                                    replytweet(sender, replyid, settings.messages.error.expand({name: sender}));
                                    return;
                                }
                                winston.info('%s tipped %s %d%s', sender, to, amount, settings.coin.short_name)
                                replytweet(sender, replyid, settings.messages.tipped.expand({sender: sender, to: to, amount: amount}));
                            });
                        } else {
                            locks[sender.toLowerCase()] = null;
                            winston.info('%s tried to tip %s %d, but has only %d', sender, to, amount, balance);
                            replytweet(sender, replyid, settings.messages.no_funds.expand({name: sender, balance: balance, short: amount - balance, amount: amount}));
                        }
                    });
                    break;
                case 'address':
                    console.log('adress');
                    var user = sender.toLowerCase();
                    getAddress(user, function (err, address) {
                        if (err) {
                            winston.error('Error in !address command', err);
                            replytweet(sender, replyid, settings.messages.error.expand({name: sender}));
                            return;
                        }
                        replytweet(sender, replyid, settings.messages.deposit_address.expand({name: user, address: address}));
                    });
                    break;
                case 'balance':
                    console.log('balance');
                    var user = sender.toLowerCase();
                    coin.getBalance(settings.rpc.prefix + user, settings.coin.min_confirmations, function (err, balance) {
                        if (err) {
                            winston.error('Error in !balance command', err);
                            replytweet(sender, replyid, settings.messages.error.expand({name: sender}));
                            return;
                        }
                        var balance = typeof (balance) == 'object' ? balance.result : balance;
                        coin.getBalance(settings.rpc.prefix + user, 0, function (err, unconfirmed_balance) {
                            if (err) {
                                winston.error('Error in !balance command', err);
                                replytweet(sender, replyid, settings.messages.balance.expand({balance: balance, name: user}));
                                return;
                            }
                            var unconfirmed_balance = typeof (unconfirmed_balance) == 'object' ? unconfirmed_balance.result : unconfirmed_balance;
                            replytweet(sender, replyid, settings.messages.balance_unconfirmed.expand({balance: balance, name: user, unconfirmed: unconfirmed_balance - balance}));
                        })
                    });
                    break;
                case 'withdraw':
                    console.log('withdrawl');
                    var match = message.match(/^.?withdraw (\S+)$/);
                    if (match == null) {
                        replytweet(sender, replyid, 'Usage: !withdraw <' + settings.coin.full_name + ' address>');
                        return;
                    }
                    var address = match[1];
                    coin.validateAddress(address, function (err, reply) {
                        if (err) {
                            winston.error('Error in !withdraw command', err);
                            replytweet(sender, replyid, settings.messages.error.expand({name: sender}));
                            return;
                        }
                        if (reply.isvalid) {
                            coin.getBalance(settings.rpc.prefix + sender.toLowerCase(), settings.coin.min_confirmations, function (err, balance) {
                                if (err) {
                                    winston.error('Error in !withdraw command', err);
                                    replytweet(sender, replyid, settings.messages.error.expand({name: sender}));
                                    return;
                                }
                                var balance = typeof (balance) == 'object' ? balance.result : balance;
                                if (balance < settings.coin.min_withdraw) {
                                    winston.warn('%s tried to withdraw %d, but min is set to %d', sender, balance, settings.coin.min_withdraw);
                                    replytweet(sender, replyid, settings.messages.withdraw_too_small.expand({name: sender, balance: balance}));
                                    return;
                                }
                                coin.sendFrom(settings.rpc.prefix + sender.toLowerCase(), address, balance - settings.coin.withdrawal_fee, function (err, reply) {
                                    if (err) {
                                        winston.error('Error in !withdraw command', err);
                                        replytweet(sender, replyid, settings.messages.error.expand({name: sender}));
                                        return;
                                    }
                                    var values = {name: sender, address: address, balance: balance, amount: balance - settings.coin.withdrawal_fee, transaction: reply}
                                    for (var i = 0; i < settings.messages.withdraw_success.length; i++) {
                                        var msg = settings.messages.withdraw_success[i];
                                        replytweet(sender, replyid, msg.expand(values));
                                    }
                                    ;
    // transfer the rest (withdrawal fee - txfee) to bots wallet
                                    coin.getBalance(settings.rpc.prefix + sender.toLowerCase(), function (err, balance) {
                                        if (err) {
                                            winston.error('Something went wrong while transferring fees', err);
                                            return;
                                        }
                                        var balance = typeof (balance) == 'object' ? balance.result : balance;
    // moves the rest to bot's wallet
                                        coin.move(settings.rpc.prefix + sender.toLowerCase(), settings.rpc.prefix + settings.login.nickname.toLowerCase(), balance);
                                    });
                                });
                            });
                        } else {
                            winston.warn('%s tried to withdraw to an invalid address', sender);
                            replytweet(sender, replyid, settings.messages.invalid_address.expand({address: address, name: sender}));
                        }
                    });
                    break;
                default:
                    winston.warn("Invalid Command" + command);
                    break;
            }
        });
    });
