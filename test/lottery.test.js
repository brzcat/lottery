const assert = require('assert');
// local test network - auto generate some number of accounts.  Always completes transaction near real-time.
const ganache = require('ganache-cli');
// we are using a Constructor function (that's why its uppercase); how we retrieve info from ethereum network
// needs a provider as well as account
const Web3 = require('web3');

//lower case means instance.  the provider is what allows us to get into any other network.
const web3 = new Web3(ganache.provider());
// pulled from definition from contract.
// abi (interface) translation network to the javascript world -- bytecode is the compiled code.
const {interface, bytecode} = require("../compile");

let testAccountsForLocalTesting;
let lottery;

beforeEach(async () => {
    // Get the list of all accounts; every call we make in web3 is async in ature
    testAccountsForLocalTesting = await web3.eth.getAccounts();
    // Use one of those accounts to deploy the contract
    // constructor ; remember when we modify blockchain, we need to pay some gas
    // new web3.eth.Contract(JSON.parse(interface))
    lottery = await new web3.eth.Contract(JSON.parse(interface))
        .deploy({data: bytecode})
        .send({from: testAccountsForLocalTesting[0], gas: "1000000"});
});

describe('Lottery Contract', () => {
    it('deploys a contract', () => {
        console.log(lottery);
        assert.ok(lottery.options.address);
    });

    // tests behavior
    // enter lottery

    it('allows one account to enter lottery', async () => {

        // specify amount and value to send since this method is payable
        // web3.util toWei will convert amount of wei to ether.
        await lottery.methods.enter().send({
            from: testAccountsForLocalTesting[0],
            value: web3.utils.toWei('0.02', 'ether')
        })
        const players = await lottery.methods.getPlayers().call({
            from: testAccountsForLocalTesting[0]
        });

        assert.equal(testAccountsForLocalTesting[0], players[0]);
        assert.equal(1, players.length);

    });
    it('allows multiple account to enter lottery', async () => {
        await Promise.all([1, 2, 3].map(async item => {
            await lottery.methods.enter().send({
                from: testAccountsForLocalTesting[item],
                value: web3.utils.toWei('0.02', 'ether')
            });
        }));
        const players = await lottery.methods.getPlayers().call({
            from: testAccountsForLocalTesting[0]
        });

        _.isEqual(players, testAccountsForLocalTesting);
        assert.equal(3, players.length);

    });

    it('requires minimum amount of ether to enter', async () => {
        try {
            await lottery.methods.pickWinner().send({
                from: testAccountsForLocalTesting[1],
                value: 0
            })
            assert(false);
        } catch (err) {
            assert(err);
        }
    });

    it('non manager is unable to pick winner', async () => {
        try {
            await lottery.methods.pickWinner().send({
                from: testAccountsForLocalTesting[2]
            })
            assert(false);
        } catch (err) {
            assert(err);
        }
    });
    it('sends money to winner and reset player array', async () => {
        try {
            await lottery.methods.enter().send({
                from: testAccountsForLocalTesting[0],
                value: web3.utils.toWei('2', 'ether')
            })
            //returns either in units by wei.
            const initialBalance = await web3.eth.getBalance(testAccountsForLocalTesting[0]);
            await lottery.methods.pickWinner().send({from: testAccountsForLocalTesting[0]});
            const finalBalance = await web3.eth.getBalance(testAccountsForLocalTesting[0]);
            const difference = finalBalance - initialBalance;

            assert(difference > web3.utils.toWei('1.8', 'ether'));

            // players reset to zero
            const players = await lottery.methods.getPlayers().call({
                from: testAccountsForLocalTesting[0]
            });
            assert.equal(0, players.length);

            // lottery balance reset to zero
            const balance = await lottery.methods.getBalance().call({
                from: testAccountsForLocalTesting[0]
            });

            assert.equal(0, balance);
        } catch (err) {
            assert(false);
        }
    });
});