dogedtip-twitter is an open-source node.js twitter bot for tipping with DogecoinDark. 

It is forked off uneks IRC node-tip-bot (https://github.com/unek/node-tip-bot)
It uses [node-dogecoindark](https://github.com/doged/node-dogecoindark) for integration with DOGED's JSON RPC API.

# Installation
To install node-tip-bot simply clone this repo and install dependencies:
```bash
git clone https://github.com/doged/dogedtip-twitter
cd dogedtip-twitter
npm install
```
After installation proceed to the configuration.

# Configuration
To configure, copy the `config/config.sample.yml` file to `config/config.yml`.

## twitter
Create an application at dev.twitter.com and fill in your keys.
* **consumer_key: ''
* **consumer_secret: ''
* **access_token_key: ''
* **access_token_secret: '' 

## log
Logging settings.
* **file** - file to log to. Set to `false` to disable logging to file.

## rpc
JSON RPC API connection info.
* **host** - JSON RPC API hostname
* **port** - API port (by default 22555 for dogecoin)
* **user** - API username
* **pass** - API password (keep that secure)

## coin
Basic coin settings.
* **withdrawal_fee** - fee charged on withdraw to cover up txfee, the rest goes to bot's wallet.
* **min_withdraw** - minimum amount of coins to withdraw
* **min_confirmations** - minimum amount of confirmations needed to tip/withdraw coins
* **min_tip** - minimum amount of coins to tip
* **short_name** - short coin's name (eg. `Đ` or `DOGE`)
* **full_name** - full coin's name (eg. `dogecoin`)

# How to run it?
Before running the bot, you have to be running your DOGED daemon with JSON-RPC API enabled. To enable, add this to your DOGED daemon configuration file (eg. `~/.DogeCoinDark/DogeCoinDark.conf`):
```ini
server=1
daemon=1
rpcuser=<your username>
rpcpassword=<your super secret password>
rpcallowip=<your bot's ip address or just 127.0.0.1 if hosted on the same machine>
```
To run the bot simply use `node bin/tipbot` or `npm start`.

## Commands
Commands are executed by placing skeinbot <command> <arguments> in a tweet.

| **Command** | **Arguments**     | **Description**
|-------------|-------------------|--------------------------------------------------------------------
| `balance`   |                   | displays your current wallet balance
| `address`   |                   | displays address where you can send your funds to the tip bot
| `withdraw`  | `<address>`       | withdraws your whole wallet balance to specified address
| `tip`       | `<nick> <amount>` | sends the specified amount of coins to the specified nickname
| `help`      |                   | displays configured help message (by default similiar to this one)
| `terms`     |                   | displays terms and conditions for using the tip bot


